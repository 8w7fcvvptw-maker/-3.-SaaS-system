import dotenv from "dotenv";

dotenv.config();

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

function requirePort(name) {
  const value = requireEnv(name);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`[config] Environment variable ${name} must be a positive integer`);
  }
  return parsed;
}

export const config = {
  nodeEnv: process.env.NODE_ENV?.trim() || "development",
  port: requirePort("PORT"),
  webhookUrl: process.env.WEBHOOK_URL?.trim() || null,
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
  resetWebhookOnLocalStart: process.env.RESET_WEBHOOK_ON_LOCAL_START?.trim() === "true",
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  managerChatId: process.env.MANAGER_CHAT_ID?.trim() || null,
  /** Опционально: без ключа бот не падает, в сценарии «Задать вопрос» показывается шаблонный ответ */
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
};
