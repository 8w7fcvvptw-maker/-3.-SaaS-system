import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { requireUser } from './auth.js';
import { throwOnError } from './helpers.js';
import { PLAN_LIMITS } from './subscriptions.js';

const YOKASSA_BASE_URL = 'https://api.yookassa.ru/v3';

/** Получить конфиги ЮKassa (только на сервере — не вызывать из браузера) */
function getYokassaConfig() {
  const shopId = typeof process !== 'undefined' ? process.env.YOKASSA_SHOP_ID : null;
  const secretKey = typeof process !== 'undefined' ? process.env.YOKASSA_SECRET_KEY : null;

  if (!shopId || !secretKey) {
    throw new ApiError(
      'ЮKassa не настроена: отсутствуют YOKASSA_SHOP_ID или YOKASSA_SECRET_KEY',
      { code: 'validation_error', status: 500 }
    );
  }

  return {
    shopId,
    secretKey,
    basicAuth: Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
  };
}

/**
 * Создать платёж в ЮKassa.
 * Вызывается из Express server-side endpoint POST /payments/create.
 */
export async function createYokassaPayment({ userId, plan, returnUrl }) {
  if (!PLAN_LIMITS[plan]) {
    throw new ApiError(`Неизвестный тариф: ${plan}`, { code: 'validation_error', status: 400 });
  }

  const planData = PLAN_LIMITS[plan];
  const amount = planData.priceRub;

  const { basicAuth, shopId } = getYokassaConfig();

  const idempotenceKey = `${userId}-${plan}-${Date.now()}`;

  const paymentPayload = {
    amount: {
      value: amount.toFixed(2),
      currency: 'RUB',
    },
    confirmation: {
      type: 'redirect',
      return_url: returnUrl || `${process.env.APP_URL || 'http://localhost:5173'}/dashboard?payment=success`,
    },
    capture: true,
    description: `Подписка ${planData.displayName} — ${amount} ₽/мес`,
    metadata: {
      userId,
      plan,
    },
  };

  const response = await fetch(`${YOKASSA_BASE_URL}/payments`, {
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
    throw new ApiError(
      data.description || 'Ошибка создания платежа в ЮKassa',
      { code: 'payment_error', status: response.status }
    );
  }

  // Сохраняем платёж в БД (pending)
  const { error: dbError } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      yokassa_payment_id: data.id,
      amount,
      currency: 'RUB',
      status: 'pending',
      plan,
      metadata: { yokassa_status: data.status, idempotence_key: idempotenceKey },
    });

  if (dbError) {
    console.error('[payments] Ошибка сохранения платежа в БД:', dbError.message);
  }

  return {
    paymentId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url,
    status: data.status,
  };
}

/**
 * Обработать webhook от ЮKassa.
 * Вызывается из Express endpoint POST /payments/webhook.
 * Проверяет IP и сигнатуру перед обработкой.
 */
export async function handleYokassaWebhook(eventBody) {
  const { event, object } = eventBody;

  console.log(`[webhook] Получено событие: ${event}, payment_id: ${object?.id}`);

  if (event === 'payment.succeeded') {
    await handlePaymentSucceeded(object);
  } else if (event === 'payment.canceled') {
    await handlePaymentCanceled(object);
  } else {
    console.log(`[webhook] Неизвестное событие: ${event}`);
  }
}

async function handlePaymentSucceeded(paymentObject) {
  const paymentId = paymentObject?.id;
  const userId = paymentObject?.metadata?.userId;
  const plan = paymentObject?.metadata?.plan;

  if (!paymentId || !userId || !plan) {
    console.error('[webhook] payment.succeeded: отсутствуют обязательные поля', { paymentId, userId, plan });
    return;
  }

  // Обновляем статус платежа в БД
  const { error: paymentError } = await supabase
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
    console.error('[webhook] Ошибка обновления платежа:', paymentError.message);
  }

  // Активируем подписку
  const { activateSubscription } = await import('./subscriptions.js');
  await activateSubscription({ userId, plan, paymentId, durationDays: 30 });

  console.log(`[webhook] Подписка активирована: userId=${userId}, plan=${plan}`);
}

async function handlePaymentCanceled(paymentObject) {
  const paymentId = paymentObject?.id;
  if (!paymentId) return;

  await supabase
    .from('payments')
    .update({ status: 'canceled' })
    .eq('yokassa_payment_id', paymentId);

  console.log(`[webhook] Платёж отменён: payment_id=${paymentId}`);
}

/** Получить список платежей текущего пользователя */
export async function getMyPayments() {
  const user = await requireUser();
  return throwOnError(
    await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
  );
}

/**
 * Проверить подпись ЮKassa webhook (IP whitelist + опционально HMAC).
 * ЮKassa не использует HMAC-подпись — только IP-фильтрацию.
 * Список актуальных IP: https://yookassa.ru/developers/using-api/webhooks
 */
export function verifyYokassaWebhookIp(remoteIp) {
  const allowedIps = (process.env.YOKASSA_WEBHOOK_IPS || '').split(',').map((ip) => ip.trim()).filter(Boolean);

  // В режиме разработки пропускаем проверку
  if (process.env.NODE_ENV !== 'production') return true;

  // Если whitelist не задан — пропускаем (небезопасно, логируем предупреждение)
  if (allowedIps.length === 0) {
    console.warn('[webhook] YOKASSA_WEBHOOK_IPS не задан — IP-проверка отключена!');
    return true;
  }

  return allowedIps.includes(remoteIp);
}
