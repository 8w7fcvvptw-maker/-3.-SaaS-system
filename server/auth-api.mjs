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
import crypto from "node:crypto";
import { assertEmail, assertPassword } from "../backend/lib/validation.js";
import { ApiError } from "../backend/lib/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

loadEnv({ path: path.join(root, "frontend", ".env") });
loadEnv({ path: path.join(root, "frontend", ".env.local") });
loadEnv({ path: path.join(root, ".env") });

const PORT = Number(process.env.AUTH_API_PORT || process.env.PORT || 3001);

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

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(corsMiddleware);
app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "32kb" }));

const PLAN_PRICES = {
  basic: { amount: 990, displayName: "Basic" },
  pro: { amount: 2990, displayName: "Pro" },
  unlimited: { amount: 9990, displayName: "Unlimited" },
};

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
  return data?.role ?? "client";
}

async function getActiveSubscriptionByUserId(userId) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (data.end_date && new Date(data.end_date) < new Date()) return null;
  return data;
}

function getYookassaAuth() {
  const shopId = process.env.YOKASSA_SHOP_ID;
  const secretKey = process.env.YOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) return null;
  return Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

function verifyYookassaWebhookSignature(req) {
  const secret = process.env.YOKASSA_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = req.headers["x-yookassa-signature"];
  if (!signature || !Buffer.isBuffer(req.body)) return false;
  const digest = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
  return digest === signature;
}

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
    console.error("[auth-api] /api/auth/login", e);
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
    return res.json({ session: data.session, user: data.user });
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    console.error("[auth-api] /api/auth/register", e);
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.get("/api/subscription/status", async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ message: "Требуется авторизация", code: "auth_required" });
  const role = await getUserRole(user.id);
  const subscription = await getActiveSubscriptionByUserId(user.id);
  return res.json({
    role,
    subscription,
    hasActiveSubscription: !!subscription,
  });
});

app.post("/api/payments/create", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ message: "Требуется авторизация", code: "auth_required" });
    const yookassaAuth = getYookassaAuth();
    if (!yookassaAuth) {
      return res.status(503).json({
        message: "Платежи временно отключены: ЮKassa еще не настроена.",
        code: "payments_disabled",
      });
    }

    const { plan, returnUrl } = req.body || {};
    const planData = PLAN_PRICES[plan];
    if (!planData) return res.status(400).json({ message: "Некорректный тариф", code: "validation_error" });

    const ykRes = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${yookassaAuth}`,
        "Idempotence-Key": `${user.id}-${plan}-${Date.now()}`,
      },
      body: JSON.stringify({
        amount: { value: planData.amount.toFixed(2), currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: returnUrl || `${process.env.APP_URL || "http://localhost:5173"}/dashboard?payment=success`,
        },
        capture: true,
        description: `Подписка ${planData.displayName}`,
        metadata: { userId: user.id, plan },
      }),
    });

    const ykData = await ykRes.json();
    if (!ykRes.ok) {
      return res.status(400).json({
        message: ykData?.description || "Ошибка создания платежа",
        code: "payment_error",
      });
    }

    await supabaseAdmin.from("payments").insert({
      user_id: user.id,
      yokassa_payment_id: ykData.id,
      amount: planData.amount,
      currency: "RUB",
      status: "pending",
      plan,
      metadata: { yookassa_status: ykData.status },
    });

    return res.json({
      paymentId: ykData.id,
      confirmationUrl: ykData.confirmation?.confirmation_url,
      status: ykData.status,
    });
  } catch (e) {
    console.error("[auth-api] /api/payments/create", e);
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.post("/api/payments/webhook", async (req, res) => {
  try {
    if (!verifyYookassaWebhookSignature(req)) {
      return res.status(401).json({ message: "Некорректная подпись webhook", code: "invalid_signature" });
    }

    const body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf-8")) : req.body;
    const event = body?.event;
    const payment = body?.object;
    const paymentId = payment?.id;
    const userId = payment?.metadata?.userId;
    const plan = payment?.metadata?.plan;

    if (!paymentId) return res.status(200).json({ ok: true });

    if (event === "payment.succeeded") {
      await supabaseAdmin.from("payments").update({ status: "succeeded" }).eq("yokassa_payment_id", paymentId);
      if (userId && plan) {
        await supabaseAdmin.from("subscriptions").update({ status: "inactive" }).eq("user_id", userId).eq("status", "active");
        const end = new Date();
        end.setDate(end.getDate() + 30);
        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          status: "active",
          plan,
          start_date: new Date().toISOString(),
          end_date: end.toISOString(),
          yokassa_subscription_id: paymentId,
        });
        await supabaseAdmin.from("user_profiles").update({ role: "business" }).eq("id", userId).eq("role", "client");
      }
    }

    if (event === "payment.canceled") {
      await supabaseAdmin.from("payments").update({ status: "canceled" }).eq("yokassa_payment_id", paymentId);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[auth-api] /api/payments/webhook", e);
    return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
  }
});

app.get("/api/admin/stats", async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ message: "Требуется авторизация", code: "auth_required" });
  const role = await getUserRole(user.id);
  if (role !== "admin") return res.status(403).json({ message: "Доступ запрещён", code: "forbidden" });

  const { data, error } = await supabaseAdmin.rpc("get_admin_stats");
  if (error) return res.status(400).json({ message: error.message, code: "validation_error" });
  return res.json(data);
});

app.use((_req, res) => {
  res.status(404).json({ message: "Не найдено", code: "not_found" });
});

app.use((err, _req, res, _next) => {
  console.error("[auth-api] unhandled", err);
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

app.listen(PORT, "127.0.0.1", () => {
  console.info(`[auth-api] http://127.0.0.1:${PORT} (POST /api/auth/login, /api/auth/register)`);
});
