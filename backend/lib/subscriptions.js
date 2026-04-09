import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { requireUser } from './auth.js';
import { throwOnError } from './helpers.js';

function isSubscriptionEnforced() {
  return import.meta.env?.VITE_ENFORCE_SUBSCRIPTION !== 'false';
}

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

/** Получить активную подписку текущего пользователя */
export async function getActiveSubscription() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });
  if (!data) return null;

  // Проверяем срок действия
  if (data.end_date && new Date(data.end_date) < new Date()) {
    await supabase
      .from('subscriptions')
      .update({ status: 'inactive' })
      .eq('id', data.id);
    return null;
  }

  return data;
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

/** Проверить квоту записей на текущий месяц */
export async function checkAppointmentQuota(businessId) {
  if (!isSubscriptionEnforced()) return;

  const user = await requireUser();
  const role = await getUserRole(user.id);

  if (role === 'admin') return;
  if (role === 'client') return;

  const sub = await getActiveSubscription();
  if (!sub) {
    throw new ApiError(
      'Требуется активная подписка для создания записей. Выберите тарифный план.',
      { code: 'subscription_required', status: 403 }
    );
  }

  const limits = PLAN_LIMITS[sub.plan];
  if (limits.appointmentsPerMonth === -1) return; // unlimited

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
  if (!isSubscriptionEnforced()) return;

  const user = await requireUser();
  const role = await getUserRole(user.id);

  if (role === 'admin') return;

  const sub = await getActiveSubscription();
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

/** Получить роль пользователя из user_profiles */
export async function getUserRole(userId) {
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role ?? 'client';
}

/** Активировать подписку после успешного платежа (вызывается из webhook) */
export async function activateSubscription({ userId, plan, paymentId, durationDays = 30 }) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);

  // Деактивируем старые активные подписки
  await supabase
    .from('subscriptions')
    .update({ status: 'inactive' })
    .eq('user_id', userId)
    .eq('status', 'active');

  // Создаём новую активную подписку
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      status: 'active',
      plan,
      start_date: new Date().toISOString(),
      end_date: endDate.toISOString(),
      yokassa_subscription_id: paymentId,
    })
    .select()
    .single();

  if (error) throw new ApiError(`Ошибка активации подписки: ${error.message}`, { code: 'validation_error', status: 400 });

  // Меняем роль пользователя на business если нужно
  await supabase
    .from('user_profiles')
    .update({ role: 'business' })
    .eq('id', userId)
    .eq('role', 'client');

  return data;
}

/** Получить квоты из БД (с кэшем на стороне клиента) */
export async function getPlanQuotas() {
  return throwOnError(
    await supabase.from('plan_quotas').select('*').order('price_rub')
  );
}
