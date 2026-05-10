/**
 * Локальный API для входа/регистрации с rate limit.
 * В dev Vite проксирует /api → этот сервер (см. frontend/vite.config.js).
 */
import { config as loadEnv } from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assertEmail, assertPassword } from "../backend/lib/validation.js";
import { ApiError } from "../backend/lib/errors.js";
import {
  createPayment,
  handleYokassaWebhook,
  verifyYokassaWebhookIp,
} from "../backend/lib/yookassa.js";
import { runNotificationEventScheduler } from "../backend/lib/notifications.js";
import {
  initObservability,
  logBusinessEvent,
  logError,
  requestContextMiddleware,
  requestLogMiddleware,
} from "./observability.mjs";
import { runMonitoringSelfTest } from "./yc-monitoring.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

loadEnv({ path: path.join(root, "frontend", ".env") });
loadEnv({ path: path.join(root, "frontend", ".env.local") });
loadEnv({ path: path.join(root, ".env") });

const PORT = Number(process.env.PORT || process.env.AUTH_API_PORT || 3000);
const ycMonitoringEnvOk = initObservability();
console.log(
  JSON.stringify({
    level: "info",
    event: "auth-api.boot",
    yandexMonitoringEnvOk: ycMonitoringEnvOk,
    hint: ycMonitoringEnvOk
      ? "yc_vars_ok_see_yc_monitoring_ready_if_logged_above"
      : "yc_vars_missing_check_YC_FOLDER_ID_YC_SERVICE_ACCOUNT_ID_YC_ACCESS_KEY_ID_YC_PRIVATE_KEY",
    timestamp: new Date().toISOString(),
  }),
);

function normalizeOrigin(origin) {
  return String(origin).replace(/\/$/, "");
}

/** Тот же смысл, что в Edge Function: список origin без «*». В проде задайте ALLOWED_ORIGINS в .env */
function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => normalizeOrigin(s.trim()))
      .filter(Boolean);
  }
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
  ];
}

/** @returns {string | null | false} разрешённый origin, null — нет заголовка Origin, false — запрещён */
function resolveAllowedOrigin(originHeader) {
  if (!originHeader) return null;
  const n = normalizeOrigin(originHeader);
  return getAllowedOrigins().includes(n) ? n : false;
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const allowed = resolveAllowedOrigin(origin);

  if (origin && allowed === false) {
    if (req.method === "OPTIONS") {
      return res.status(403).end();
    }
    return res.status(403).json({
      message: "Доступ с этого адреса не разрешён (CORS).",
      code: "cors_forbidden",
    });
  }

  if (typeof allowed === "string") {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}

function getSupabaseAnon() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      "[auth-api] Задайте SUPABASE_URL и SUPABASE_ANON_KEY (или VITE_SUPABASE_* в frontend/.env).",
    );
    process.exit(1);
  }
  return createClient(url, key);
}

const supabase = getSupabaseAnon();

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[auth-api] Задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY для server-side операций.");
    process.exit(1);
  }
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const supabaseAdmin = getSupabaseAdmin();

function skipRateLimit() {
  return process.env.SKIP_AUTH_RATE_LIMIT === "1" || process.env.AUTH_RATE_LIMIT_ENABLED === "false";
}

const windowMs = 15 * 60 * 1000;
const maxAttempts = 10;

const loginLimiter = rateLimit({
  windowMs,
  max: maxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  handler: (_req, res) => {
    res.status(429).json({
      message:
        "Слишком много попыток входа за 15 минут. Подождите и попробуйте снова.",
      code: "rate_limit",
    });
  },
});

const registerLimiter = rateLimit({
  windowMs,
  max: maxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  handler: (_req, res) => {
    res.status(429).json({
      message:
        "Слишком много попыток регистрации за 15 минут. Подождите и попробуйте снова.",
      code: "rate_limit",
    });
  },
});

const monitoringIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  handler: (_req, res) => {
    res.status(429).json({ message: "Слишком много запросов мониторинга.", code: "rate_limit" });
  },
});

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(requestContextMiddleware);
app.use(requestLogMiddleware);
app.use(corsMiddleware);

/** Проверка, что контейнер Railway поднялся (корень и /health). */
app.get(["/", "/health"], (_req, res) => {
  res.json({
    ok: true,
    service: "auth-api",
    endpoints: [
      "/api/auth/login",
      "/api/auth/register",
      "/api/payments/create",
      "/api/payments/webhook",
      "/api/admin/stats",
      "/api/admin/businesses",
      "/api/admin/subscriptions",
      "/api/admin/payments",
      "/api/monitoring/ingest",
      "/api/monitoring/self-test",
    ],
  });
});

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

async function getRequestUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function getUserRole(userId) {
  const { data } = await supabaseAdmin.from("user_profiles").select("role").eq("id", userId).maybeSingle();
  const role = String(data?.role ?? "client").toLowerCase();
  if (role === "admin" || role === "business" || role === "client") return role;
  if (role === "owner") return "business";
  if (role === "customer") return "client";
  return "client";
}

function normalizeSubscriptionStatus(rawStatus) {
  const status = String(rawStatus ?? "").toLowerCase();
  if (status === "active" || status === "trial" || status === "past_due" || status === "canceled") return status;
  if (status === "cancelled") return "canceled";
  return "inactive";
}

function hasEntitlement(status) {
  const normalized = normalizeSubscriptionStatus(status);
  return normalized === "active" || normalized === "trial";
}

async function getOwnerBusinessByUserId(userId) {
  const { data } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ? data : null;
}

async function getActiveSubscriptionByUserId(userId) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "trial", "past_due", "canceled", "inactive"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (!Array.isArray(data) || !data.length) return null;
  const [latest] = [...data].sort((left, right) => {
    const priority = ["active", "trial", "past_due", "canceled", "inactive"];
    const leftRank = priority.indexOf(normalizeSubscriptionStatus(left?.status));
    const rightRank = priority.indexOf(normalizeSubscriptionStatus(right?.status));
    if (leftRank !== rightRank) return leftRank - rightRank;
    return new Date(right?.created_at ?? 0).valueOf() - new Date(left?.created_at ?? 0).valueOf();
  });
  if (!latest) return null;
  const expired = latest.end_date && new Date(latest.end_date) < new Date();
  const status = expired && hasEntitlement(latest.status) ? "past_due" : normalizeSubscriptionStatus(latest.status);
  return { ...latest, status };
}

const SUBSCRIPTION_STATUS_PRIORITY = ["active", "trial", "past_due", "canceled", "inactive"];

function normalizePaymentStatus(rawStatus) {
  const status = String(rawStatus ?? "").toLowerCase();
  if (status === "pending" || status === "succeeded" || status === "canceled" || status === "refunded") return status;
  return "failed";
}

function toMoneyNumber(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function buildLatestSubscriptionByUser(subscriptions) {
  const grouped = new Map();
  for (const row of subscriptions ?? []) {
    const uid = row?.user_id;
    if (!uid) continue;
    const normalizedStatus = normalizeSubscriptionStatus(row.status);
    const normalizedRow = { ...row, status: normalizedStatus };
    const prev = grouped.get(uid);
    if (!prev) {
      grouped.set(uid, normalizedRow);
      continue;
    }
    const prevRank = SUBSCRIPTION_STATUS_PRIORITY.indexOf(prev.status);
    const nextRank = SUBSCRIPTION_STATUS_PRIORITY.indexOf(normalizedRow.status);
    if (nextRank < prevRank) {
      grouped.set(uid, normalizedRow);
      continue;
    }
    if (nextRank === prevRank) {
      const prevTs = new Date(prev.created_at ?? 0).valueOf();
      const nextTs = new Date(normalizedRow.created_at ?? 0).valueOf();
      if (nextTs > prevTs) grouped.set(uid, normalizedRow);
    }
  }
  return grouped;
}

function normalizeSubscriptionRow(row) {
  if (!row) return null;
  const status = normalizeSubscriptionStatus(row.status);
  const end = row.end_date ? new Date(row.end_date) : null;
  const expired =
    end instanceof Date && !Number.isNaN(end.valueOf()) && end.valueOf() < Date.now();
  const normalizedStatus = expired && hasEntitlement(status) ? "past_due" : status;
  return { ...row, status: normalizedStatus };
}

function computeBillingState(subscription) {
  if (!subscription) return "inactive";
  if (subscription.status === "trial") return "trial";
  if (subscription.status === "active") return "paid";
  if (subscription.status === "past_due") return "past_due";
  if (subscription.status === "canceled") return "canceled";
  return "inactive";
}

function requireAdminFromRole(role) {
  return role === "admin";
}

async function requireAdminUser(req, res) {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ message: "Требуется авторизация", code: "auth_required" });
    return null;
  }
  const role = await getUserRole(user.id);
  if (!requireAdminFromRole(role)) {
    res.status(403).json({ message: "Доступ запрещён", code: "forbidden" });
    return null;
  }
  return user;
}

async function getAdminAnalyticsSnapshot() {
  const [profilesRes, businessesRes, subscriptionsRes, paymentsRes, quotasRes] = await Promise.all([
    supabaseAdmin.from("user_profiles").select("id, role"),
    supabaseAdmin.from("businesses").select("id, user_id, name, status, created_at").order("created_at", { ascending: false }),
    supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, plan, status, start_date, end_date, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabaseAdmin
      .from("payments")
      .select("id, user_id, subscription_id, amount, currency, status, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(3000),
    supabaseAdmin.from("plan_quotas").select("plan, display_name, price_rub"),
  ]);

  if (profilesRes.error) throw new ApiError(profilesRes.error.message, { code: "validation_error", status: 400 });
  if (businessesRes.error) throw new ApiError(businessesRes.error.message, { code: "validation_error", status: 400 });
  if (subscriptionsRes.error) throw new ApiError(subscriptionsRes.error.message, { code: "validation_error", status: 400 });
  if (paymentsRes.error) throw new ApiError(paymentsRes.error.message, { code: "validation_error", status: 400 });
  if (quotasRes.error) throw new ApiError(quotasRes.error.message, { code: "validation_error", status: 400 });

  const profiles = profilesRes.data ?? [];
  const businesses = businessesRes.data ?? [];
  const subscriptions = (subscriptionsRes.data ?? []).map(normalizeSubscriptionRow).filter(Boolean);
  const payments = paymentsRes.data ?? [];
  const quotas = quotasRes.data ?? [];

  const planMeta = new Map();
  for (const q of quotas) {
    planMeta.set(q.plan, {
      displayName: q.display_name ?? String(q.plan ?? "").toUpperCase(),
      priceRub: toMoneyNumber(q.price_rub),
    });
  }

  const latestSubByUser = buildLatestSubscriptionByUser(subscriptions);

  const paymentsByUser = new Map();
  const paymentStatusCounters = {
    pending: 0,
    succeeded: 0,
    canceled: 0,
    refunded: 0,
    failed: 0,
  };
  let totalRevenue = 0;
  for (const payment of payments) {
    const status = normalizePaymentStatus(payment.status);
    paymentStatusCounters[status] = (paymentStatusCounters[status] ?? 0) + 1;
    const uid = payment.user_id;
    if (!uid) continue;
    const amount = toMoneyNumber(payment.amount);
    const prev = paymentsByUser.get(uid) ?? {
      successfulPayments: 0,
      totalPayments: 0,
      totalRevenue: 0,
      lastPaymentAt: null,
    };
    prev.totalPayments += 1;
    if (status === "succeeded") {
      prev.successfulPayments += 1;
      prev.totalRevenue += amount;
      totalRevenue += amount;
    }
    if (!prev.lastPaymentAt || new Date(payment.created_at ?? 0) > new Date(prev.lastPaymentAt)) {
      prev.lastPaymentAt = payment.created_at ?? null;
    }
    paymentsByUser.set(uid, prev);
  }

  const businessRows = businesses.map((business) => {
    const latestSub = latestSubByUser.get(business.user_id) ?? null;
    const subscription = latestSub ? normalizeSubscriptionRow(latestSub) : null;
    const paymentAgg = paymentsByUser.get(business.user_id) ?? null;
    const billingState = computeBillingState(subscription);
    const planKey = subscription?.plan ?? null;
    const planInfo = planKey ? planMeta.get(planKey) : null;
    const isPaid = billingState === "paid";
    return {
      id: business.id,
      ownerUserId: business.user_id,
      name: business.name ?? `Business #${business.id}`,
      businessStatus: business.status ?? "unknown",
      createdAt: business.created_at ?? null,
      planKey,
      planName: planInfo?.displayName ?? "—",
      subscriptionStatus: subscription?.status ?? "inactive",
      billingState,
      startDate: subscription?.start_date ?? null,
      endDate: subscription?.end_date ?? null,
      mrrContribution: isPaid ? toMoneyNumber(planInfo?.priceRub) : 0,
      successfulPayments: paymentAgg?.successfulPayments ?? 0,
      totalPayments: paymentAgg?.totalPayments ?? 0,
      totalRevenue: paymentAgg?.totalRevenue ?? 0,
      lastPaymentAt: paymentAgg?.lastPaymentAt ?? null,
    };
  });

  const totalUsers = profiles.length;
  const totalBusinesses = businessRows.length;
  const paidBusinesses = businessRows.filter((b) => b.billingState === "paid").length;
  const trialBusinesses = businessRows.filter((b) => b.billingState === "trial").length;
  const pastDueBusinesses = businessRows.filter((b) => b.billingState === "past_due").length;
  const canceledBusinesses = businessRows.filter((b) => b.billingState === "canceled").length;
  const inactiveBusinesses = businessRows.filter((b) => b.billingState === "inactive").length;
  const mrr = businessRows.reduce((sum, b) => sum + toMoneyNumber(b.mrrContribution), 0);

  const denominator = paidBusinesses + trialBusinesses;
  const trialToPaidRate = denominator > 0 ? (paidBusinesses / denominator) * 100 : 0;

  const recentPayments = payments.slice(0, 50).map((payment) => ({
    id: payment.id,
    userId: payment.user_id,
    subscriptionId: payment.subscription_id,
    amount: toMoneyNumber(payment.amount),
    currency: payment.currency ?? "RUB",
    status: normalizePaymentStatus(payment.status),
    plan: payment.plan ?? null,
    createdAt: payment.created_at ?? null,
  }));

  const recentSubscriptions = [...latestSubByUser.values()]
    .map(normalizeSubscriptionRow)
    .filter(Boolean)
    .sort((left, right) => new Date(right.created_at ?? 0).valueOf() - new Date(left.created_at ?? 0).valueOf())
    .slice(0, 100)
    .map((s) => ({
      id: s.id,
      userId: s.user_id,
      plan: s.plan ?? null,
      status: s.status ?? "inactive",
      startDate: s.start_date ?? null,
      endDate: s.end_date ?? null,
      createdAt: s.created_at ?? null,
    }));

  return {
    totals: {
      totalUsers,
      totalBusinesses,
      paidBusinesses,
      trialBusinesses,
      activeSubscriptions: paidBusinesses,
      trialSubscriptions: trialBusinesses,
      pastDueSubscriptions: pastDueBusinesses,
      canceledSubscriptions: canceledBusinesses,
      inactiveSubscriptions: inactiveBusinesses,
    },
    finance: {
      totalRevenue,
      mrr,
      pendingPayments: paymentStatusCounters.pending,
      successfulPayments: paymentStatusCounters.succeeded,
      canceledPayments: paymentStatusCounters.canceled,
      refundedPayments: paymentStatusCounters.refunded,
      failedPayments: paymentStatusCounters.failed,
    },
    funnel: {
      trialToPaidRate,
      denominator,
    },
    businesses: businessRows,
    subscriptions: recentSubscriptions,
    payments: recentPayments,
  };
}

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    try {
      const remoteIp = req.ip || req.socket?.remoteAddress || "";
      if (!verifyYokassaWebhookIp(remoteIp)) {
        return res.status(403).json({ message: "IP не в whitelist ЮKassa", code: "webhook_ip_forbidden" });
      }

      await handleYokassaWebhook(req, { supabaseAdmin });
      logBusinessEvent("payment_webhook_processed", { requestId: req.requestId });
      return res.status(200).json({ ok: true });
    } catch (e) {
      if (e instanceof ApiError) {
        return res.status(e.status).json({ message: e.message, code: e.code });
      }
      logError(e, { requestId: req.requestId, route: "/api/payments/webhook" });
      return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
    }
  },
);

app.use(express.json({ limit: "32kb" }));

function canRunNotificationScheduler(req) {
  const secret = process.env.NOTIFICATION_SCHEDULER_SECRET?.trim();
  if (secret) {
    return req.headers["x-notification-scheduler-secret"] === secret;
  }
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.NOTIFICATION_SCHEDULER_ALLOW_UNSECURED_DEV === "1";
}

app.post("/api/notifications/scheduler/run", async (req, res) => {
  try {
    if (!canRunNotificationScheduler(req)) {
      return res.status(403).json({
        message: "Доступ запрещён для запуска планировщика уведомлений",
        code: "forbidden",
      });
    }

    const result = await runNotificationEventScheduler({
      supabaseClient: supabaseAdmin,
      lookbehindMinutes: req.body?.lookbehindMinutes,
      maxTemplates: req.body?.maxTemplates,
      maxAppointmentsPerTemplate: req.body?.maxAppointmentsPerTemplate,
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    logError(e, { requestId: req.requestId, route: "/api/notifications/scheduler/run" });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

async function handleMonitoringSelfTest(req, res) {
  const shared =
    process.env.YC_SELF_TEST_SECRET?.trim() || process.env.MONITORING_INGEST_SECRET?.trim();
  if (!shared) {
    return res.status(503).json({
      ok: false,
      message:
        "Задайте MONITORING_INGEST_SECRET (или YC_SELF_TEST_SECRET) на Railway. Передайте тот же ключ заголовком x-monitoring-secret или GET-параметром ?secret= (параметр только для быстрой проверки).",
    });
  }
  const fromHeader = req.headers["x-monitoring-secret"];
  const fromQuery = typeof req.query?.secret === "string" ? req.query.secret : "";
  const provided = fromHeader || fromQuery;
  if (provided !== shared) {
    return res.status(403).json({
      ok: false,
      message:
        "Неверный или пустой секрет. Нужен заголовок x-monitoring-secret или ?secret= — та же строка, что MONITORING_INGEST_SECRET в Railway.",
    });
  }
  const result = await runMonitoringSelfTest();
  return res.status(result.ok ? 200 : 502).json(result);
}

/** GET — чтобы проверка открывалась из браузера; POST — предпочтительнее (секрет не светится в URL). */
app.get("/api/monitoring/self-test", monitoringIngestLimiter, handleMonitoringSelfTest);
app.post("/api/monitoring/self-test", monitoringIngestLimiter, handleMonitoringSelfTest);

app.post("/api/monitoring/ingest", monitoringIngestLimiter, async (req, res) => {
  try {
    const secret = process.env.MONITORING_INGEST_SECRET?.trim();
    if (secret && req.headers["x-monitoring-secret"] !== secret) {
      return res.status(403).json({ message: "Доступ запрещён", code: "forbidden" });
    }
    const body = req.body || {};
    if (body.kind !== "error") {
      return res.status(400).json({ message: "Ожидается kind=error", code: "validation_error" });
    }
    const raw = typeof body.message === "string" ? body.message : "";
    const err = new Error(raw.slice(0, 2000) || "frontend_error");
    if (typeof body.name === "string") err.name = body.name.slice(0, 120);
    logError(err, {
      route: "frontend.ingest",
      frontend: true,
      tags: {
        ...(typeof body.area === "string" ? { area: body.area } : {}),
        ...(typeof body.action === "string" ? { action: body.action } : {}),
      },
    });
    return res.status(204).end();
  } catch (e) {
    logError(e, { requestId: req.requestId, route: "/api/monitoring/ingest" });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const email = req.body?.email;
    const password = req.body?.password;
    assertEmail(email);
    assertPassword(password);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({
        message: error.message || "Не удалось войти",
        code: "auth_failed",
      });
    }
    return res.json({ session: data.session, user: data.user });
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    logError(e, { requestId: req.requestId, route: "/api/auth/login" });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.post("/api/auth/register", registerLimiter, async (req, res) => {
  try {
    const email = req.body?.email;
    const password = req.body?.password;
    assertEmail(email);
    assertPassword(password);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return res.status(400).json({
        message: error.message || "Не удалось зарегистрироваться",
        code: "signup_failed",
      });
    }
    logBusinessEvent("registration", {
      requestId: req.requestId,
      userId: data?.user?.id || null,
    });
    return res.json({ session: data.session, user: data.user });
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    logError(e, { requestId: req.requestId, route: "/api/auth/register" });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.get("/api/subscription/status", async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ message: "Требуется авторизация", code: "auth_required" });
  const [role, business, subscription] = await Promise.all([
    getUserRole(user.id),
    getOwnerBusinessByUserId(user.id),
    getActiveSubscriptionByUserId(user.id),
  ]);
  const isAdmin = role === "admin";
  const isOwner = !isAdmin && (role === "business" || !!business?.id);
  const userType = isAdmin ? "admin" : isOwner ? "owner" : "customer";
  const hasOwnerEntitlement = hasEntitlement(subscription?.status);
  return res.json({
    role,
    userType,
    hasBusiness: !!business?.id,
    businessId: business?.id ?? null,
    subscriptionStatus: normalizeSubscriptionStatus(subscription?.status),
    subscription,
    hasOwnerEntitlement,
    hasActiveSubscription: hasOwnerEntitlement,
    access: {
      isAdmin,
      isOwner,
      isCustomer: userType === "customer",
      needsOnboarding: isOwner && !business?.id,
      requiresPaywall: isOwner && !!business?.id && !hasOwnerEntitlement,
      canAccessOwnerApp: isAdmin || (isOwner && !!business?.id && hasOwnerEntitlement),
    },
  });
});

app.post("/api/payments/create", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ message: "Требуется авторизация", code: "auth_required" });
    const { plan, returnUrl } = req.body || {};
    if (!plan || typeof plan !== "string") {
      return res.status(400).json({ message: "Укажите тариф (plan)", code: "validation_error" });
    }

    const result = await createPayment(user.id, plan, supabaseAdmin, returnUrl);
    logBusinessEvent("order_created", {
      requestId: req.requestId,
      userId: user.id,
      plan,
      paymentId: result?.paymentId || null,
    });
    return res.json(result);
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    logError(e, {
      requestId: req.requestId,
      route: "/api/payments/create",
      tags: { area: "payments" },
    });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.get("/api/admin/stats", async (req, res) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    const snapshot = await getAdminAnalyticsSnapshot();
    const totalRevenue = snapshot.finance.totalRevenue;
    const activeSubscriptions = snapshot.totals.activeSubscriptions;
    const totalBusinesses = snapshot.totals.totalBusinesses;
    const totalUsers = snapshot.totals.totalUsers;
    return res.json({
      totalRevenue,
      activeSubscriptions,
      totalBusinessUsers: totalBusinesses,
      totalUsers,
      mrr: snapshot.finance.mrr,
      paidBusinesses: snapshot.totals.paidBusinesses,
      trialBusinesses: snapshot.totals.trialBusinesses,
      trialToPaidRate: snapshot.funnel.trialToPaidRate,
      pastDueSubscriptions: snapshot.totals.pastDueSubscriptions,
      canceledSubscriptions: snapshot.totals.canceledSubscriptions,
      inactiveSubscriptions: snapshot.totals.inactiveSubscriptions,
      pendingPayments: snapshot.finance.pendingPayments,
      refundedPayments: snapshot.finance.refundedPayments,
      failedPayments: snapshot.finance.failedPayments,
      successfulPayments: snapshot.finance.successfulPayments,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    logError(e, { requestId: req.requestId, route: "/api/admin/stats" });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.get("/api/admin/businesses", async (req, res) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    const snapshot = await getAdminAnalyticsSnapshot();
    return res.json(snapshot.businesses);
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    logError(e, { requestId: req.requestId, route: "/api/admin/businesses" });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.get("/api/admin/subscriptions", async (req, res) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    const snapshot = await getAdminAnalyticsSnapshot();
    return res.json(snapshot.subscriptions);
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    logError(e, { requestId: req.requestId, route: "/api/admin/subscriptions" });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.get("/api/admin/payments", async (req, res) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    const snapshot = await getAdminAnalyticsSnapshot();
    return res.json(snapshot.payments);
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    logError(e, { requestId: req.requestId, route: "/api/admin/payments" });
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.use((_req, res) => {
  res.status(404).json({ message: "Не найдено", code: "not_found" });
});

app.use((err, _req, res, _next) => {
  logError(err, { route: "unhandled" });
  const raw = err?.status ?? err?.statusCode ?? 500;
  const status = Number(raw);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const body = {
    message:
      safeStatus === 400
        ? "Некорректный запрос"
        : "Внутренняя ошибка сервера",
    code: safeStatus === 400 ? "bad_request" : "server_error",
  };
  res.status(safeStatus).json(body);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.info(`[auth-api] http://0.0.0.0:${PORT} — /api/auth/login, /api/auth/register, /api/payments/*`);
});
