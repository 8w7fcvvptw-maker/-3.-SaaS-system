import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { MAIN_MENU_ITEMS, mainMenuKeyboard } from "./keyboards.js";
import { createLeadScene } from "./scenes/leadScene.js";
import { getBusinessTypes } from "./repositories/businessTypesRepository.js";
import { getTariffs } from "./repositories/tariffsRepository.js";
import { createLead } from "./repositories/leadsRepository.js";
import { checkSupabaseConnection } from "./supabaseClient.js";

const bot = new Telegraf(config.telegramBotToken);
const leadScene = createLeadScene({
  getBusinessTypes,
  getTariffs,
  createLead,
});

function formatTariffsMessage(tariffs) {
  if (tariffs.length === 0) {
    return "Сейчас тарифы недоступны. Попробуйте позже.";
  }
  const lines = tariffs.map((item) => `- ${item.name}: ${item.description || "без описания"}`);
  return ["Доступные тарифы:", ...lines].join("\n");
}

async function notifyManagerAboutLead(ctx, lead) {
  if (!config.managerChatId) {
    return;
  }

  const message = [
    "Новая заявка из Telegram-бота:",
    `Имя: ${lead.name || "не указано"}`,
    `Username: ${lead.username ? `@${lead.username}` : "не указан"}`,
    `Telegram ID: ${lead.telegram_id}`,
    `Тип бизнеса: ${lead.business_type}`,
    `Тариф: ${lead.tariff}`,
    `Описание: ${lead.task_description}`,
    `Сотрудников: ${lead.employees_count}`,
    `Контакт: ${lead.contact}`,
  ].join("\n");

  try {
    await ctx.telegram.sendMessage(config.managerChatId, message);
  } catch (error) {
    console.error("[telegram] Failed to notify manager chat:", {
      managerChatId: config.managerChatId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function showMainMenu(ctx) {
  await ctx.reply("Главное меню:", mainMenuKeyboard());
}

bot.start(async (ctx) => {
  leadScene.resetState(String(ctx.from.id));
  await ctx.reply(
    "Привет! Я помогу оставить заявку на подключение SaaS-системы.",
    mainMenuKeyboard(),
  );
});

bot.hears(MAIN_MENU_ITEMS.leaveLead, async (ctx) => {
  await leadScene.start(ctx);
});

bot.hears(MAIN_MENU_ITEMS.viewTariffs, async (ctx) => {
  const tariffs = await getTariffs();
  await ctx.reply(formatTariffsMessage(tariffs), mainMenuKeyboard());
});

bot.hears(MAIN_MENU_ITEMS.askQuestion, async (ctx) => {
  await ctx.reply(
    "Пока AI-консультант не подключен. Оставьте заявку, и менеджер свяжется с вами для консультации.",
    mainMenuKeyboard(),
  );
});

bot.on("text", async (ctx) => {
  const input = ctx.message.text.trim();
  const result = await leadScene.handleInput(ctx, input);
  if (!result) {
    await ctx.reply("Выберите действие из главного меню.", mainMenuKeyboard());
    return;
  }

  if (typeof result === "object" && result.lead) {
    await notifyManagerAboutLead(ctx, result.lead);
    leadScene.resetState(String(ctx.from.id));
    await showMainMenu(ctx);
  }
});

bot.catch((error) => {
  console.error("[telegram] Unhandled bot error:", error);
});

const isSupabaseAvailable = await checkSupabaseConnection();
if (!isSupabaseAvailable) {
  console.error("[startup] Bot started, but Supabase connectivity check failed.");
}

bot.launch().then(() => {
  console.log("[startup] Telegram bot is running.");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
