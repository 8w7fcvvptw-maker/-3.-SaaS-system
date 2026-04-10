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
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });
  if (!data) return null;

  if (data.end_date && new Date(data.end_date) < new Date()) {
    await client.from('subscriptions').update({ status: 'inactive' }).eq('id', data.id);
    return null;
  }

  return data;
}

/**
 * Требует активную подписку для указанного пользователя (роль business — на стороне вызывающего кода).
 */
export async function requireActiveSubscription(userId) {
  const row = await fetchActiveSubscriptionRow(supabase, userId);
  if (!row) {
    throw new ApiError(
      'Доступ запрещён: нет активной подписки. Оформите тарифный план для продолжения работы.',
      { code: 'subscription_required', status: 403 }
    );
  }
  return row;
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
  const sub = await getActiveSubscription();
  return sub !== null;
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
  return data?.role ?? 'client';
}

/** Проверить квоту записей на текущий месяц */
export async function checkAppointmentQuota(businessId) {
  const user = await requireUser();
  const role = await getUserRole(user.id);

  if (role === 'admin') return;
  if (role === 'client') return;

  const sub = await fetchActiveSubscriptionRow(supabase, user.id);
  if (!sub) {
    throw new ApiError(
      'Требуется активная подписка для создания записей. Выберите тарифный план.',
      { code: 'subscription_required', status: 403 }
    );
  }

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
  const role = await getUserRole(user.id);

  if (role === 'admin') return;

  const sub = await fetchActiveSubscriptionRow(supabase, user.id);
  if (!sub) {
    throw new ApiError(
      'Требуется активная подписка для управления услугами. Выберите тарифный план.',
      { code: 'subscription_required', status: 403 }
    );
  }

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
