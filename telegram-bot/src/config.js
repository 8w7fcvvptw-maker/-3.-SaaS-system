import dotenv from "dotenv";

dotenv.config();

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV?.trim() || "development",
  port: Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3000,
  webhookUrl: process.env.WEBHOOK_URL?.trim() || null,
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
  resetWebhookOnLocalStart: process.env.RESET_WEBHOOK_ON_LOCAL_START?.trim() === "true",
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  managerChatId: process.env.MANAGER_CHAT_ID?.trim() || null,
};
