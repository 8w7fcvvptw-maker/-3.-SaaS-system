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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

loadEnv({ path: path.join(root, "frontend", ".env") });
loadEnv({ path: path.join(root, "frontend", ".env.local") });
loadEnv({ path: path.join(root, ".env") });

const PORT = Number(process.env.PORT || process.env.AUTH_API_PORT || 3000);

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

/** Проверка, что контейнер Railway поднялся (корень и /health). */
app.get(["/", "/health"], (_req, res) => {
  res.json({
    ok: true,
    service: "auth-api",
    endpoints: ["/api/auth/login", "/api/auth/register", "/api/payments/create", "/api/payments/webhook"],
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
      return res.status(200).json({ ok: true });
    } catch (e) {
      if (e instanceof ApiError) {
        return res.status(e.status).json({ message: e.message, code: e.code });
      }
      console.error("[auth-api] /api/payments/webhook", e);
      return res.status(500).json({ message: "Внутренняя ошибка сервера", code: "server_error" });
    }
  },
);

app.use(express.json({ limit: "32kb" }));

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
    const { plan, returnUrl } = req.body || {};
    if (!plan || typeof plan !== "string") {
      return res.status(400).json({ message: "Укажите тариф (plan)", code: "validation_error" });
    }

    const result = await createPayment(user.id, plan, supabaseAdmin, returnUrl);
    return res.json(result);
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json({ message: e.message, code: e.code, field: e.field });
    }
    console.error("[auth-api] /api/payments/create", e);
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.info(`[auth-api] http://0.0.0.0:${PORT} — /api/auth/login, /api/auth/register, /api/payments/*`);
});
