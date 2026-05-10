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
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  managerChatId: process.env.MANAGER_CHAT_ID?.trim() || null,
};
