import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { requireUser } from './auth.js';
import { throwOnError } from './helpers.js';

export const PLAN_LIMITS = {
  basic: {
    appointmentsPerMonth: 50,
    servicesLimit: 10,
    staffLimit: 2,
    displayName: 'Basic',
    priceRub: 990,
  },
  pro: {
    appointmentsPerMonth: 300,
    servicesLimit: 50,
    staffLimit: 10,
    displayName: 'Pro',
    priceRub: 2990,
  },
  unlimited: {
    appointmentsPerMonth: -1,
    servicesLimit: -1,
    staffLimit: -1,
    displayName: 'Unlimited',
    priceRub: 9990,
  },
};

export const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  INACTIVE: 'inactive',
};

const ENTITLED_SUBSCRIPTION_STATUSES = new Set([
  SUBSCRIPTION_STATUSES.TRIAL,
  SUBSCRIPTION_STATUSES.ACTIVE,
]);

const SUBSCRIPTION_STATUS_PRIORITY = [
  SUBSCRIPTION_STATUSES.ACTIVE,
  SUBSCRIPTION_STATUSES.TRIAL,
  SUBSCRIPTION_STATUSES.PAST_DUE,
  SUBSCRIPTION_STATUSES.CANCELED,
  SUBSCRIPTION_STATUSES.INACTIVE,
];

const LEGACY_ROLE_TO_USER_TYPE = {
  admin: 'admin',
  business: 'owner',
  owner: 'owner',
  client: 'customer',
  customer: 'customer',
};

function normalizeSubscriptionStatus(rawStatus) {
  const status = String(rawStatus ?? '').trim().toLowerCase();
  if (status === 'cancelled') return SUBSCRIPTION_STATUSES.CANCELED;
  if (status === 'past_due') return SUBSCRIPTION_STATUSES.PAST_DUE;
  if (status === 'trial') return SUBSCRIPTION_STATUSES.TRIAL;
  if (status === 'active') return SUBSCRIPTION_STATUSES.ACTIVE;
  if (status === 'canceled') return SUBSCRIPTION_STATUSES.CANCELED;
  return SUBSCRIPTION_STATUSES.INACTIVE;
}

function normalizeLegacyRole(rawRole) {
  const role = String(rawRole ?? '').trim().toLowerCase();
  if (role === 'admin' || role === 'business' || role === 'client') return role;
  if (role === 'owner') return 'business';
  if (role === 'customer') return 'client';
  return 'client';
}

function normalizeSubscriptionRow(row) {
  if (!row) return null;
  const normalizedStatus = normalizeSubscriptionStatus(row.status);
  const expiresAt = row.end_date ? new Date(row.end_date) : null;
  const isExpired = expiresAt instanceof Date && !Number.isNaN(expiresAt.valueOf()) && expiresAt < new Date();
  const status = isExpired && ENTITLED_SUBSCRIPTION_STATUSES.has(normalizedStatus)
    ? SUBSCRIPTION_STATUSES.PAST_DUE
    : normalizedStatus;
  return {
    ...row,
    status,
  };
}

function pickBestSubscriptionRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const normalizedRows = rows.map(normalizeSubscriptionRow).filter(Boolean);
  if (!normalizedRows.length) return null;
  normalizedRows.sort((left, right) => {
    const leftRank = SUBSCRIPTION_STATUS_PRIORITY.indexOf(left.status);
    const rightRank = SUBSCRIPTION_STATUS_PRIORITY.indexOf(right.status);
    if (leftRank !== rightRank) return leftRank - rightRank;
    const leftCreatedAt = new Date(left.created_at ?? 0).valueOf();
    const rightCreatedAt = new Date(right.created_at ?? 0).valueOf();
    return rightCreatedAt - leftCreatedAt;
  });
  return normalizedRows[0];
}

function statusHasOwnerEntitlement(status) {
  return ENTITLED_SUBSCRIPTION_STATUSES.has(normalizeSubscriptionStatus(status));
}

async function hasBusinessByUserId(client, userId) {
  if (!userId) return { hasBusiness: false, businessId: null };
  const { data, error } = await client
    .from('businesses')
    .select('id')
    .eq('user_id', userId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });
  return {
    hasBusiness: !!data?.id,
    businessId: data?.id ?? null,
  };
}

function buildAccessSnapshot({ role, hasBusiness, businessId, subscription }) {
  const userTypeByRole = LEGACY_ROLE_TO_USER_TYPE[role] ?? 'customer';
  const isAdmin = userTypeByRole === 'admin';
  const isOwner = !isAdmin && (userTypeByRole === 'owner' || hasBusiness);
  const userType = isAdmin ? 'admin' : isOwner ? 'owner' : 'customer';
  const subscriptionStatus = normalizeSubscriptionStatus(subscription?.status);
  const hasOwnerEntitlement = statusHasOwnerEntitlement(subscriptionStatus);
  const needsOnboarding = isOwner && !hasBusiness;
  const requiresPaywall = isOwner && hasBusiness && !hasOwnerEntitlement;

  return {
    role,
    userType,
    businessId,
    hasBusiness,
    subscription: subscription ?? null,
    subscriptionStatus,
    hasOwnerEntitlement,
    hasActiveSubscription: hasOwnerEntitlement,
    access: {
      isAdmin,
      isOwner,
      isCustomer: userType === 'customer',
      needsOnboarding,
      requiresPaywall,
      canAccessOwnerApp: isAdmin || (isOwner && !needsOnboarding && !requiresPaywall),
    },
  };
}

export async function getLatestSubscription(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });
  return pickBestSubscriptionRow(data ?? []);
}

export async function getAccessProfile(userId) {
  if (!userId) return null;
  const [role, businessState, subscription] = await Promise.all([
    getUserRole(userId),
    hasBusinessByUserId(supabase, userId),
    getLatestSubscription(userId),
  ]);
  return buildAccessSnapshot({
    role,
    hasBusiness: businessState.hasBusiness,
    businessId: businessState.businessId,
    subscription,
  });
}

/**
 * Активная подписка по user_id (без привязки к текущей сессии).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function fetchActiveSubscriptionRow(client, userId) {
  if (!userId) return null;
  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', [SUBSCRIPTION_STATUSES.ACTIVE, SUBSCRIPTION_STATUSES.TRIAL])
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });
  const row = pickBestSubscriptionRow(data ?? []);
  if (!row) return null;
  if (row.status === SUBSCRIPTION_STATUSES.PAST_DUE || row.status === SUBSCRIPTION_STATUSES.CANCELED) {
    return null;
  }
  return row;
}

/**
 * Требует активную подписку для указанного пользователя (роль business — на стороне вызывающего кода).
 */
export async function requireActiveSubscription(userId) {
  const access = await getAccessProfile(userId);
  if (!access) {
    throw new ApiError('Требуется авторизация', { code: 'auth_required', status: 401 });
  }
  if (access.access.isAdmin) return access.subscription;
  if (!access.hasBusiness) return null;
  if (!access.hasOwnerEntitlement) {
    throw new ApiError(
      'Доступ запрещён: нужен trial или активная подписка. Оформите тарифный план для продолжения работы.',
      { code: 'subscription_required', status: 403 }
    );
  }
  return access.subscription;
}

/** Получить активную подписку текущего пользователя */
export async function getActiveSubscription() {
  const user = await requireUser();
  return fetchActiveSubscriptionRow(supabase, user.id);
}

/** Получить все подписки текущего пользователя */
export async function getMySubscriptions() {
  const user = await requireUser();
  return throwOnError(
    await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
  );
}

/** Проверить, есть ли активная подписка (boolean) */
export async function hasActiveSubscription() {
  const access = await getMyAccessProfile();
  return !!access?.hasOwnerEntitlement;
}

/** Получить лимиты текущего плана */
export async function getCurrentPlanLimits() {
  const sub = await getActiveSubscription();
  const plan = sub?.plan ?? 'basic';
  return { plan, ...PLAN_LIMITS[plan] };
}

/** Получить роль пользователя из user_profiles */
export async function getUserRole(userId) {
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return normalizeLegacyRole(data?.role ?? 'client');
}

export async function getMyAccessProfile() {
  const user = await requireUser();
  return getAccessProfile(user.id);
}

/** Проверить квоту записей на текущий месяц */
export async function checkAppointmentQuota(businessId) {
  const user = await requireUser();
  const access = await getAccessProfile(user.id);
  if (!access) return;
  if (access.access.isAdmin) return;
  if (!access.access.isOwner) return;
  if (!access.hasBusiness) return;
  if (!access.hasOwnerEntitlement) {
    throw new ApiError(
      'Требуется активная подписка для создания записей. Выберите тарифный план.',
      { code: 'subscription_required', status: 403 }
    );
  }
  const sub = access.subscription;

  const limits = PLAN_LIMITS[sub.plan];
  if (limits.appointmentsPerMonth === -1) return;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', monthStart);

  if (error) return;

  if ((count ?? 0) >= limits.appointmentsPerMonth) {
    throw new ApiError(
      `Достигнут лимит записей для тарифа ${limits.displayName} (${limits.appointmentsPerMonth}/мес). Upgrade plan.`,
      { code: 'quota_exceeded', status: 403 }
    );
  }
}

/** Проверить квоту услуг */
export async function checkServicesQuota(businessId) {
  const user = await requireUser();
  const access = await getAccessProfile(user.id);
  if (!access) return;
  if (access.access.isAdmin) return;
  if (!access.access.isOwner) return;
  if (!access.hasBusiness) return;
  if (!access.hasOwnerEntitlement) {
    throw new ApiError(
      'Требуется активная подписка для управления услугами. Выберите тарифный план.',
      { code: 'subscription_required', status: 403 }
    );
  }
  const sub = access.subscription;

  const limits = PLAN_LIMITS[sub.plan];
  if (limits.servicesLimit === -1) return;

  const { count, error } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);

  if (error) return;

  if ((count ?? 0) >= limits.servicesLimit) {
    throw new ApiError(
      `Достигнут лимит услуг для тарифа ${limits.displayName} (${limits.servicesLimit}). Upgrade plan.`,
      { code: 'quota_exceeded', status: 403 }
    );
  }
}

const DEFAULT_DURATION_MONTHS = 1;

function computeEndDateMonths(months = DEFAULT_DURATION_MONTHS) {
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);
  return endDate.toISOString();
}

/**
 * Активация подписки (service role / webhook). Создаёт новую активную запись, старые active → inactive.
 */
export async function activateSubscriptionWithSupabase(client, userId, plan, { paymentId = null, durationMonths = DEFAULT_DURATION_MONTHS } = {}) {
  if (!PLAN_LIMITS[plan]) {
    throw new ApiError(`Неизвестный тариф: ${plan}`, { code: 'validation_error', status: 400 });
  }

  const endDate = computeEndDateMonths(durationMonths);

  await client.from('subscriptions').update({ status: 'inactive' }).eq('user_id', userId).eq('status', 'active');

  const { data, error } = await client
    .from('subscriptions')
    .insert({
      user_id: userId,
      status: 'active',
      plan,
      start_date: new Date().toISOString(),
      end_date: endDate,
      yokassa_subscription_id: paymentId,
    })
    .select()
    .single();

  if (error) {
    throw new ApiError(`Ошибка активации подписки: ${error.message}`, {
      code: 'validation_error',
      status: 400,
    });
  }

  await client.from('user_profiles').update({ role: 'business' }).eq('id', userId).eq('role', 'client');

  return data;
}

/**
 * Активация из клиента Supabase (anon + JWT). Для webhook используйте activateSubscriptionWithSupabase + service role.
 */
export async function activateSubscription(userId, plan, options = {}) {
  return activateSubscriptionWithSupabase(supabase, userId, plan, options);
}

/** Получить квоты из БД */
export async function getPlanQuotas() {
  return throwOnError(await supabase.from('plan_quotas').select('*').order('price_rub'));
}
