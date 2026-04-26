import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { runNotificationEventScheduler } from "../backend/lib/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

loadEnv({ path: path.join(root, "frontend", ".env") });
loadEnv({ path: path.join(root, "frontend", ".env.local") });
loadEnv({ path: path.join(root, ".env") });

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY для notification scheduler");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  const supabaseAdmin = getSupabaseAdmin();
  const lookbehindMinutes = process.env.NOTIFICATION_SCHEDULER_LOOKBEHIND_MINUTES;
  const maxTemplates = process.env.NOTIFICATION_SCHEDULER_MAX_TEMPLATES;
  const maxAppointmentsPerTemplate = process.env.NOTIFICATION_SCHEDULER_MAX_APPOINTMENTS_PER_TEMPLATE;

  const result = await runNotificationEventScheduler({
    supabaseClient: supabaseAdmin,
    lookbehindMinutes,
    maxTemplates,
    maxAppointmentsPerTemplate,
  });

  console.log(
    JSON.stringify({
      level: "info",
      event: "notification.scheduler.run",
      ...result,
      timestamp: new Date().toISOString(),
    })
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "notification.scheduler.failed",
      message: error?.message ?? String(error),
      timestamp: new Date().toISOString(),
    })
  );
  process.exit(1);
});
