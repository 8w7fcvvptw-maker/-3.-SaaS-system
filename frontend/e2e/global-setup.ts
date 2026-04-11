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
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const email = process.env.E2E_LOGIN_EMAIL?.trim();
  if (!url || !serviceKey || !email) {
    console.warn(
      "[e2e global-setup] Без SUPABASE_SERVICE_ROLE_KEY или E2E_LOGIN_EMAIL подписка не создаётся — сценарии с услугами могут упасть (403).",
    );
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.warn("[e2e global-setup] auth.admin.listUsers:", listErr.message);
    return;
  }

  const user = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (!user) {
    console.warn(
      `[e2e global-setup] Пользователь ${email} не найден среди первых 1000 auth.users — подписка не создана.`,
    );
    return;
  }

  await admin.from("subscriptions").update({ status: "inactive" }).eq("user_id", user.id).eq("status", "active");

  const { error: insErr } = await admin.from("subscriptions").insert({
    user_id: user.id,
    status: "active",
    plan: "basic",
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 365 * 86400000).toISOString(),
  });

  if (insErr) {
    console.warn("[e2e global-setup] subscriptions.insert:", insErr.message);
    return;
  }

  console.info(`[e2e global-setup] Активная подписка (basic) для E2E: ${email}`);
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
