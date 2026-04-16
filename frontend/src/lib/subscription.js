import { supabase } from './supabase.js';
import { normalizeBrowserApiBase } from '../../../backend/lib/browserApiBase.js';
import { captureError, trackBusinessEvent } from './monitoring.js';

export const PLAN_LIMITS = {
  basic: { displayName: 'Basic', appointmentsPerMonth: 50, servicesLimit: 10, priceRub: 990 },
  pro: { displayName: 'Pro', appointmentsPerMonth: 300, servicesLimit: 50, priceRub: 2990 },
  unlimited: { displayName: 'Unlimited', appointmentsPerMonth: -1, servicesLimit: -1, priceRub: 9990 },
};

/** Получить активную подписку текущего пользователя */
export async function getActiveSubscription() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Проверить срок
  if (data.end_date && new Date(data.end_date) < new Date()) return null;
  return data;
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

  return data?.role ?? 'client';
}

/** Получить полный профиль с ролью и подпиской */
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [roleResult, subscription] = await Promise.all([
    supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle(),
    getActiveSubscription(),
  ]);

  return {
    id: user.id,
    email: user.email,
    role: roleResult.data?.role ?? 'client',
    subscription,
    hasActiveSubscription: subscription !== null,
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
