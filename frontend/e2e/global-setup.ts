import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");
const repoRoot = path.join(frontendRoot, "..");
/** Сначала корень репо (часто там SUPABASE_SERVICE_ROLE_KEY для auth-api), затем frontend — локальные значения перекрывают. */
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(frontendRoot, ".env") });
dotenv.config({ path: path.join(frontendRoot, ".env.local") });

/**
 * Роль business без активной подписки не может создавать услуги (backend gate).
 * Через service role создаём подписку для E2E_LOGIN_EMAIL до прогона тестов.
 */
async function ensureE2eBusinessSubscription() {
  const url = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const email = process.env.E2E_LOGIN_EMAIL?.trim();
  const password = process.env.E2E_LOGIN_PASSWORD?.trim();
  if (!url || !email || !password) {
    console.warn(
      "[e2e global-setup] Без E2E_LOGIN_EMAIL/E2E_LOGIN_PASSWORD подписка не создаётся — сценарии с услугами могут упасть (403).",
    );
    return;
  }

  if (serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (!listErr) {
      const user = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
      if (user) {
        await admin.from("subscriptions").update({ status: "inactive" }).eq("user_id", user.id).eq("status", "active");
        const { error: insErr } = await admin.from("subscriptions").insert({
          user_id: user.id,
          status: "active",
          plan: "basic",
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 365 * 86400000).toISOString(),
        });
        if (!insErr) {
          console.info(`[e2e global-setup] Активная подписка (basic) для E2E (service role): ${email}`);
          return;
        }
        console.warn("[e2e global-setup] subscriptions.insert via service role:", insErr.message);
      }
    } else {
      console.warn("[e2e global-setup] auth.admin.listUsers:", listErr.message);
    }
  }

  if (!anonKey) {
    console.warn("[e2e global-setup] Нет SUPABASE_SERVICE_ROLE_KEY и SUPABASE_ANON_KEY — fallback невозможен.");
    return;
  }

  // Fallback: подписываем тестового пользователя его же JWT под RLS.
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr || !signInData?.user?.id) {
    console.warn("[e2e global-setup] signInWithPassword fallback:", signInErr?.message || "user not found");
    return;
  }
  const userId = signInData.user.id;

  await client.from("subscriptions").update({ status: "inactive" }).eq("user_id", userId).eq("status", "active");
  const { error: insOwnErr } = await client.from("subscriptions").insert({
    user_id: userId,
    status: "active",
    plan: "basic",
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 365 * 86400000).toISOString(),
  });
  if (insOwnErr) {
    console.warn("[e2e global-setup] subscriptions.insert fallback:", insOwnErr.message);
    return;
  }

  console.info(`[e2e global-setup] Активная подписка (basic) для E2E (fallback): ${email}`);
}

/** Перед прогоном убираем файл сессии E2E от прошлого запуска. */
export default async function globalSetup() {
  const p = path.join(frontendRoot, "e2e", ".e2e-credentials.json");
  try {
    fs.unlinkSync(p);
  } catch {
    /* файла нет — нормально */
  }

  await ensureE2eBusinessSubscription();
}
