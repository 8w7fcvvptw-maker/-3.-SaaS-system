/**
 * ЮKassa — серверный модуль (вызывать из auth-api / Node).
 *
 * После деплоя:
 * 1. Вставить реальные YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY
 * 2. Включить PAYMENTS_ENABLED=true
 * 3. Настроить webhook URL в личном кабинете ЮKassa на https://<host>/api/payments/webhook
 * 4. Для webhook оставить только строгую серверную валидацию; dev bypass включать
 *    исключительно через YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV=1
 */
import { ApiError } from './errors.js';
import { PLAN_LIMITS } from './subscriptions.js';
import { activateSubscriptionWithSupabase } from './subscriptions.js';

const YOOKASSA_BASE_URL = 'https://api.yookassa.ru/v3';

export function isPaymentsEnabled() {
  return String(process.env.PAYMENTS_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function getShopId() {
  return typeof process !== 'undefined' ? process.env.YOOKASSA_SHOP_ID?.trim() : '';
}

function getSecretKey() {
  return typeof process !== 'undefined' ? process.env.YOOKASSA_SECRET_KEY?.trim() : '';
}

function getBasicAuth() {
  const shopId = getShopId();
  const secretKey = getSecretKey();
  if (!shopId || !secretKey) return null;
  return Buffer.from(`${shopId}:${secretKey}`).toString('base64');
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {string} plan
 * @param {string} [returnUrl]
 */
export async function createPayment(userId, plan, supabaseAdmin, returnUrl) {
  if (!PLAN_LIMITS[plan]) {
    throw new ApiError(`Неизвестный тариф: ${plan}`, { code: 'validation_error', status: 400 });
  }

  if (!isPaymentsEnabled()) {
    console.info('[yookassa] PAYMENTS_ENABLED=false — подписка активируется без оплаты (тест).');
    await activateSubscriptionWithSupabase(supabaseAdmin, userId, plan, {});
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    return {
      paymentId: `test-bypass-${Date.now()}`,
      confirmationUrl: `${appUrl}/dashboard?payment=bypass&plan=${encodeURIComponent(plan)}`,
      status: 'succeeded',
      testMode: true,
    };
  }

  const planData = PLAN_LIMITS[plan];
  const amount = planData.priceRub;
  const basicAuth = getBasicAuth();

  if (!basicAuth) {
    console.warn('[yookassa] TEST MODE: нет YOOKASSA_SHOP_ID — возвращаем mock URL (реального списания нет).');
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    return {
      paymentId: `mock-${userId}-${plan}-${Date.now()}`,
      confirmationUrl: `${appUrl}/dashboard?payment=mock&plan=${encodeURIComponent(plan)}`,
      status: 'pending',
      testMode: true,
    };
  }

  const idempotenceKey = `${userId}-${plan}-${Date.now()}`;
  const paymentPayload = {
    amount: {
      value: amount.toFixed(2),
      currency: 'RUB',
    },
    confirmation: {
      type: 'redirect',
      return_url:
        returnUrl || `${process.env.APP_URL || 'http://localhost:5173'}/dashboard?payment=success`,
    },
    capture: true,
    description: `Подписка ${planData.displayName} — ${amount} ₽/мес`,
    metadata: {
      userId,
      plan,
    },
  };

  const response = await fetch(`${YOOKASSA_BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuth}`,
      'Idempotence-Key': idempotenceKey,
    },
    body: JSON.stringify(paymentPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.description || 'Ошибка создания платежа в ЮKassa', {
      code: 'payment_error',
      status: response.status >= 400 && response.status < 600 ? response.status : 400,
    });
  }

  const { error: dbError } = await supabaseAdmin.from('payments').insert({
    user_id: userId,
    yokassa_payment_id: data.id,
    amount,
    currency: 'RUB',
    status: 'pending',
    plan,
    metadata: {
      yokassa_status: data.status,
      idempotence_key: idempotenceKey,
    },
  });

  if (dbError) {
    console.error('[yookassa] Ошибка сохранения платежа в БД:', dbError.message);
  }

  return {
    paymentId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url,
    status: data.status,
    testMode: false,
  };
}

function isExplicitDevWebhookBypassEnabled() {
  return process.env.YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV === '1';
}

function sameAmount(left, right) {
  const leftValue = String(left?.value ?? '').trim();
  const rightValue = String(right?.value ?? '').trim();
  const leftCurrency = String(left?.currency ?? '').trim();
  const rightCurrency = String(right?.currency ?? '').trim();
  if (!leftValue || !rightValue || !leftCurrency || !rightCurrency) return false;
  return leftValue === rightValue && leftCurrency === rightCurrency;
}

/**
 * По актуальной документации YooKassa для Basic Auth нет "подписи" webhook-запроса.
 * Вместо этого валидируем подлинность уведомления сверкой объекта платежа через API YooKassa:
 * - payment.id из webhook должен существовать в API;
 * - статус и сумма/валюта в webhook должны совпадать с текущим payment object.
 * В production bypass запрещён. В dev bypass возможен только при YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV=1.
 */
export async function verifyYookassaWebhookSignature(req, rawBodyBuffer) {
  if (!Buffer.isBuffer(rawBodyBuffer)) return false;

  let eventBody = null;
  try {
    eventBody = JSON.parse(rawBodyBuffer.toString('utf-8'));
  } catch {
    return false;
  }

  const notificationPayment = eventBody?.object;
  const paymentId = notificationPayment?.id;
  if (!paymentId) return false;

  const basicAuth = getBasicAuth();
  if (!basicAuth) {
    if (process.env.NODE_ENV === 'production' || !isExplicitDevWebhookBypassEnabled()) {
      console.error(
        '[yookassa] webhook verification failed: нет BasicAuth для сверки payment object; запрос отклонён.'
      );
      return false;
    }
    console.warn(
      '[yookassa] webhook verification bypassed in dev via YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV=1'
    );
    return true;
  }

  try {
    const response = await fetch(`${YOOKASSA_BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (!response.ok) return false;

    const paymentFromApi = await response.json();
    if (!paymentFromApi?.id || paymentFromApi.id !== paymentId) return false;
    if (paymentFromApi.status !== notificationPayment?.status) return false;

    return sameAmount(paymentFromApi.amount, notificationPayment?.amount);
  } catch (error) {
    console.error('[yookassa] webhook verification request failed:', error?.message || error);
    return false;
  }
}

export function verifyYokassaWebhookIp(remoteIp) {
  const allowedIps = (process.env.YOKASSA_WEBHOOK_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') return true;

  if (allowedIps.length === 0) {
    console.warn('[yookassa] YOKASSA_WEBHOOK_IPS не задан — IP whitelist отключён.');
    return true;
  }

  return allowedIps.includes(remoteIp);
}

/**
 * @param {import('express').Request} req — для webhook route используйте express.raw({ type: 'application/json' })
 * @param {{ supabaseAdmin: import('@supabase/supabase-js').SupabaseClient }} ctx
 */
export async function handleYokassaWebhook(req, ctx) {
  const { supabaseAdmin } = ctx;
  if (!supabaseAdmin) {
    throw new ApiError('Сервер БД не настроен для webhook', { code: 'server_error', status: 500 });
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}), 'utf-8');

  if (!(await verifyYookassaWebhookSignature(req, rawBody))) {
    throw new ApiError('Не пройдена валидация webhook', { code: 'invalid_signature', status: 401 });
  }

  const eventBody = JSON.parse(rawBody.toString('utf-8'));
  const { event, object } = eventBody;

  console.log(`[yookassa webhook] event=${event}, payment_id=${object?.id}`);

  if (event === 'payment.succeeded') {
    await handlePaymentSucceeded(supabaseAdmin, object);
  } else if (event === 'payment.canceled') {
    await handlePaymentCanceled(supabaseAdmin, object);
  }
}

async function handlePaymentSucceeded(supabaseAdmin, paymentObject) {
  const paymentId = paymentObject?.id;
  const userId = paymentObject?.metadata?.userId;
  const plan = paymentObject?.metadata?.plan;

  if (!paymentId || !userId || !plan) {
    console.error('[yookassa webhook] payment.succeeded: нет id / metadata.userId / metadata.plan', {
      paymentId,
      userId,
      plan,
    });
    return;
  }

  const { error: paymentError } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'succeeded',
      metadata: {
        yokassa_status: 'succeeded',
        income_amount: paymentObject.income_amount,
      },
    })
    .eq('yokassa_payment_id', paymentId);

  if (paymentError) {
    console.error('[yookassa webhook] обновление payments:', paymentError.message);
  }

  await activateSubscriptionWithSupabase(supabaseAdmin, userId, plan, { paymentId });
  console.log(`[yookassa webhook] подписка активирована userId=${userId} plan=${plan}`);
}

async function handlePaymentCanceled(supabaseAdmin, paymentObject) {
  const paymentId = paymentObject?.id;
  if (!paymentId) return;

  await supabaseAdmin.from('payments').update({ status: 'canceled' }).eq('yokassa_payment_id', paymentId);

  console.log(`[yookassa webhook] платёж отменён payment_id=${paymentId}`);
}
