import { supabase } from './supabase.js';
import { normalizeBrowserApiBase } from '../../../backend/lib/browserApiBase.js';
import { captureError, trackBusinessEvent } from './monitoring.js';

export const PLAN_LIMITS = {
  basic: { displayName: 'Basic', appointmentsPerMonth: 50, servicesLimit: 10, priceRub: 990 },
  pro: { displayName: 'Pro', appointmentsPerMonth: 300, servicesLimit: 50, priceRub: 2990 },
  unlimited: { displayName: 'Unlimited', appointmentsPerMonth: -1, servicesLimit: -1, priceRub: 9990 },
};

export const SUBSCRIPTION_STATUSES = {
  trial: 'trial',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  inactive: 'inactive',
};

const ENTITLED_STATUSES = new Set([SUBSCRIPTION_STATUSES.trial, SUBSCRIPTION_STATUSES.active]);
const STATUS_PRIORITY = [
  SUBSCRIPTION_STATUSES.active,
  SUBSCRIPTION_STATUSES.trial,
  SUBSCRIPTION_STATUSES.past_due,
  SUBSCRIPTION_STATUSES.canceled,
  SUBSCRIPTION_STATUSES.inactive,
];

function normalizeRole(rawRole) {
  const role = String(rawRole ?? '').trim().toLowerCase();
  if (role === 'admin' || role === 'business' || role === 'client') return role;
  if (role === 'owner') return 'business';
  if (role === 'customer') return 'client';
  return 'client';
}

function normalizeSubscriptionStatus(rawStatus) {
  const status = String(rawStatus ?? '').trim().toLowerCase();
  if (status === 'cancelled') return SUBSCRIPTION_STATUSES.canceled;
  if (status === SUBSCRIPTION_STATUSES.trial) return SUBSCRIPTION_STATUSES.trial;
  if (status === SUBSCRIPTION_STATUSES.active) return SUBSCRIPTION_STATUSES.active;
  if (status === SUBSCRIPTION_STATUSES.past_due) return SUBSCRIPTION_STATUSES.past_due;
  if (status === SUBSCRIPTION_STATUSES.canceled) return SUBSCRIPTION_STATUSES.canceled;
  return SUBSCRIPTION_STATUSES.inactive;
}

function normalizeSubscriptionRow(row) {
  if (!row) return null;
  const status = normalizeSubscriptionStatus(row.status);
  const expiresAt = row.end_date ? new Date(row.end_date) : null;
  const expired =
    expiresAt instanceof Date &&
    !Number.isNaN(expiresAt.valueOf()) &&
    expiresAt < new Date();
  return {
    ...row,
    status: expired && ENTITLED_STATUSES.has(status) ? SUBSCRIPTION_STATUSES.past_due : status,
  };
}

function pickCurrentSubscription(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const normalized = rows.map(normalizeSubscriptionRow).filter(Boolean);
  if (!normalized.length) return null;
  normalized.sort((left, right) => {
    const leftRank = STATUS_PRIORITY.indexOf(left.status);
    const rightRank = STATUS_PRIORITY.indexOf(right.status);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return new Date(right.created_at ?? 0).valueOf() - new Date(left.created_at ?? 0).valueOf();
  });
  return normalized[0];
}

function hasEntitlement(status) {
  return ENTITLED_STATUSES.has(normalizeSubscriptionStatus(status));
}

/** Получить активную подписку текущего пользователя */
export async function getActiveSubscription() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return null;
  const row = pickCurrentSubscription(data ?? []);
  if (!row) return null;
  return hasEntitlement(row.status) ? row : null;
}

/** Получить роль текущего пользователя */
export async function getMyRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return normalizeRole(data?.role ?? 'client');
}

async function getOwnBusiness() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.id ? data : null;
}

/** Получить полный профиль с типом пользователя и доступом */
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [roleResult, ownBusiness, subscriptionsResult] = await Promise.all([
    supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle(),
    getOwnBusiness(),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  const role = normalizeRole(roleResult.data?.role ?? 'client');
  const currentSubscription = pickCurrentSubscription(subscriptionsResult.data ?? []);
  const subscriptionStatus = normalizeSubscriptionStatus(currentSubscription?.status);
  const isAdmin = role === 'admin';
  const hasBusiness = !!ownBusiness?.id;
  const isOwner = !isAdmin && (role === 'business' || hasBusiness);
  const userType = isAdmin ? 'admin' : isOwner ? 'owner' : 'customer';
  const hasOwnerEntitlement = hasEntitlement(subscriptionStatus);
  const needsOnboarding = isOwner && !hasBusiness;
  const requiresPaywall = isOwner && hasBusiness && !hasOwnerEntitlement;

  return {
    id: user.id,
    email: user.email,
    role,
    userType,
    businessId: ownBusiness?.id ?? null,
    hasBusiness,
    subscriptionStatus,
    subscription: currentSubscription,
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

/** Инициировать оплату через сервер */
export async function initiatePayment(plan, serverUrl = '') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Требуется авторизация');

  const explicit = serverUrl || import.meta.env.VITE_SERVER_URL;
  const base =
    typeof explicit === 'string' && explicit.trim()
      ? normalizeBrowserApiBase(explicit)
      : '';
  const returnUrl = `${window.location.origin}/dashboard?payment=success&plan=${plan}`;
  const payUrl = `${base || ''}/api/payments/create`;
  trackBusinessEvent("order_create_requested", { plan });

  let response;
  try {
    response = await fetch(payUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan, returnUrl }),
    });
  } catch (error) {
    captureError(error, { tags: { area: "payments", action: "create_order" }, extra: { plan } });
    throw error;
  }

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Ошибка создания платежа');
    captureError(error, { tags: { area: "payments", action: "create_order" }, extra: { plan } });
    throw error;
  }
  trackBusinessEvent("order_create_success", { plan });
  return data;
}

/** Перенаправить пользователя на оплату ЮKassa */
export async function redirectToPayment(plan, serverUrl = '') {
  const payment = await initiatePayment(plan, serverUrl);
  if (!payment.confirmationUrl) {
    throw new Error('Платежи временно недоступны. Подключите ЮKassa позже.');
  }
  window.location.href = payment.confirmationUrl;
  return payment;
}
