import dotenv from "dotenv";

dotenv.config();

export const BOT_TOKEN = process.env.BOT_TOKEN ?? "";
export const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID ?? "";
export const DB_PATH = process.env.DB_PATH ?? "./data/telegram-bot.sqlite";
