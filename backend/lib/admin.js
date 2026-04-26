import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { throwOnError } from './helpers.js';
import { requireRole, ROLES } from './roles.js';
import { normalizeBrowserApiBase } from './browserApiBase.js';

const PLAN_DISPLAY_NAME = {
  basic: 'Basic',
  pro: 'Pro',
  unlimited: 'Unlimited',
};

function isBrowserRuntime() {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.window !== 'undefined' &&
    typeof globalThis.document !== 'undefined'
  );
}

function shouldUseAdminHttpApi() {
  return isBrowserRuntime() && import.meta.env?.VITE_USE_AUTH_API !== 'false';
}

function adminApiUrl(path) {
  const raw = import.meta.env?.VITE_SERVER_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return `${normalizeBrowserApiBase(raw)}${path}`;
  }
  return path;
}

function isRecoverableAdminApiError(error) {
  return (
    error instanceof ApiError &&
    (error.code === 'network_error' ||
      error.code === 'upstream_unreachable' ||
      error.code === 'proxy_misconfigured' ||
      error.code === 'cors_forbidden' ||
      error.code === 'not_found')
  );
}

async function adminApiFetch(path) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ApiError('Требуется авторизация', { code: 'auth_required', status: 401 });
  }

  let response;
  try {
    response = await fetch(adminApiUrl(path), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch (error) {
    throw new ApiError(error?.message || 'Ошибка сети при запросе admin API', {
      code: 'network_error',
      status: 503,
    });
  }

  let body = null;
  try {
    body = await response.json();
  } catch (_) {
    body = null;
  }

  if (!response.ok) {
    throw new ApiError(body?.message || 'Ошибка admin API', {
      code: body?.code || (response.status === 404 ? 'not_found' : 'validation_error'),
      status: response.status,
    });
  }

  return body;
}

function normalizeBusinessRow(row) {
  return {
    id: row?.id ?? null,
    ownerUserId: row?.ownerUserId ?? null,
    name: row?.name ?? '—',
    planKey: row?.planKey ?? null,
    planName: row?.planName ?? PLAN_DISPLAY_NAME[row?.planKey] ?? '—',
    businessStatus: row?.businessStatus ?? 'unknown',
    subscriptionStatus: row?.subscriptionStatus ?? 'inactive',
    billingState: row?.billingState ?? 'inactive',
    totalRevenue: Number(row?.totalRevenue ?? 0) || 0,
    successfulPayments: Number(row?.successfulPayments ?? 0) || 0,
    totalPayments: Number(row?.totalPayments ?? 0) || 0,
    mrrContribution: Number(row?.mrrContribution ?? 0) || 0,
    createdAt: row?.createdAt ?? null,
    startDate: row?.startDate ?? null,
    endDate: row?.endDate ?? null,
    lastPaymentAt: row?.lastPaymentAt ?? null,
  };
}

/** Статистика платформы для Admin */
export async function getAdminStats() {
  await requireRole(ROLES.ADMIN);

  if (shouldUseAdminHttpApi()) {
    try {
      return await adminApiFetch('/api/admin/stats');
    } catch (error) {
      if (!isRecoverableAdminApiError(error)) throw error;
    }
  }

  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });
  return {
    totalRevenue: data?.totalRevenue ?? 0,
    activeSubscriptions: data?.activeSubscriptions ?? 0,
    totalBusinessUsers: data?.totalBusinessUsers ?? 0,
    totalUsers: data?.totalUsers ?? 0,
    mrr: 0,
    paidBusinesses: data?.activeSubscriptions ?? 0,
    trialBusinesses: 0,
    trialToPaidRate: 0,
    pastDueSubscriptions: 0,
    canceledSubscriptions: 0,
    inactiveSubscriptions: 0,
    pendingPayments: 0,
    refundedPayments: 0,
    failedPayments: 0,
    successfulPayments: 0,
  };
}

/** Список всех бизнес-аккаунтов (platform admin view) */
export async function getAdminBusinesses() {
  await requireRole(ROLES.ADMIN);

  if (shouldUseAdminHttpApi()) {
    try {
      const data = await adminApiFetch('/api/admin/businesses');
      return Array.isArray(data) ? data.map(normalizeBusinessRow) : [];
    } catch (error) {
      if (!isRecoverableAdminApiError(error)) throw error;
    }
  }

  // Fallback для локального dev без admin API.
  const [businessesRes, subscriptionsRes, paymentsRes] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, user_id, name, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('user_id, plan, status, start_date, end_date, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('user_id, status, amount, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  const businesses = throwOnError(businessesRes) ?? [];
  const subscriptions = throwOnError(subscriptionsRes) ?? [];
  const payments = throwOnError(paymentsRes) ?? [];

  const latestSubByUser = new Map();
  for (const sub of subscriptions) {
    if (!sub?.user_id) continue;
    if (!latestSubByUser.has(sub.user_id)) latestSubByUser.set(sub.user_id, sub);
  }

  const paymentAggByUser = new Map();
  for (const p of payments) {
    if (!p?.user_id) continue;
    const prev = paymentAggByUser.get(p.user_id) ?? {
      totalRevenue: 0,
      totalPayments: 0,
      successfulPayments: 0,
      lastPaymentAt: null,
    };
    prev.totalPayments += 1;
    if (String(p.status) === 'succeeded') {
      prev.successfulPayments += 1;
      prev.totalRevenue += Number(p.amount ?? 0) || 0;
    }
    if (!prev.lastPaymentAt || new Date(p.created_at ?? 0) > new Date(prev.lastPaymentAt)) {
      prev.lastPaymentAt = p.created_at ?? null;
    }
    paymentAggByUser.set(p.user_id, prev);
  }

  return businesses.map((business) => {
    const latestSub = latestSubByUser.get(business.user_id) ?? null;
    const status = String(latestSub?.status ?? 'inactive');
    const billingState =
      status === 'active'
        ? 'paid'
        : status === 'trial'
          ? 'trial'
          : status === 'past_due'
            ? 'past_due'
            : status === 'canceled'
              ? 'canceled'
              : 'inactive';
    const agg = paymentAggByUser.get(business.user_id);
    return normalizeBusinessRow({
      id: business.id,
      ownerUserId: business.user_id,
      name: business.name ?? `Business #${business.id}`,
      planKey: latestSub?.plan ?? null,
      planName: PLAN_DISPLAY_NAME[latestSub?.plan] ?? '—',
      businessStatus: business.status ?? 'unknown',
      subscriptionStatus: status,
      billingState,
      totalRevenue: agg?.totalRevenue ?? 0,
      successfulPayments: agg?.successfulPayments ?? 0,
      totalPayments: agg?.totalPayments ?? 0,
      createdAt: business.created_at ?? null,
      startDate: latestSub?.start_date ?? null,
      endDate: latestSub?.end_date ?? null,
      lastPaymentAt: agg?.lastPaymentAt ?? null,
    });
  });
}

/** Список платежей платформы для Admin */
export async function getAdminPayments() {
  await requireRole(ROLES.ADMIN);

  if (shouldUseAdminHttpApi()) {
    try {
      const data = await adminApiFetch('/api/admin/payments');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (!isRecoverableAdminApiError(error)) throw error;
    }
  }

  return throwOnError(
    await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(200)
  );
}

/** Список подписок платформы для Admin */
export async function getAdminSubscriptions() {
  await requireRole(ROLES.ADMIN);

  if (shouldUseAdminHttpApi()) {
    try {
      const data = await adminApiFetch('/api/admin/subscriptions');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (!isRecoverableAdminApiError(error)) throw error;
    }
  }

  return throwOnError(
    await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
  );
}

/** Обновить роль пользователя (только Admin) */
export async function adminSetUserRole(targetUserId, newRole) {
  await requireRole(ROLES.ADMIN);
  const { setUserRole } = await import('./roles.js');
  return setUserRole(targetUserId, newRole);
}
