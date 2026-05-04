import { Telegraf } from "telegraf";
import { BOT_TOKEN, MANAGER_CHAT_ID } from "./config.js";
import { initDb } from "./db/initDb.js";
import { FAQ_PLACEHOLDER_ANSWER, MAIN_MENU_BUTTONS } from "./data/businessData.js";
import { cancelKeyboard, mainMenuKeyboard } from "./keyboards.js";
import { createLead } from "./repositories/leadsRepository.js";
import { getActiveTariffs } from "./repositories/tariffsRepository.js";
import {
  cancelLeadFlow,
  handleLeadAction,
  handleLeadTextInput,
  isLeadState,
  startLeadFlow,
} from "./scenes/leadScene.js";
import { clearUserState, getUserState, setUserState } from "./storage/memoryStorage.js";
import { isCancelInput, normalizeText } from "./utils/validators.js";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set. Fill .env before starting the bot.");
}

const bot = new Telegraf(BOT_TOKEN);

const QUESTION_FLOW = "question";
const QUESTION_STEP = "waiting_text";

function formatTariffs() {
  const tariffs = getActiveTariffs();
  const rows = tariffs.map((item) => `• ${item.title} — ${item.description}`);

  if (rows.length === 0) {
    return "Список тарифов пока недоступен.";
  }

  return ["Доступные тарифы:", ...rows].join("\n");
}

function buildQuestionAnswer() {
  // TODO: In future replace with LLM-powered answer service.
  return FAQ_PLACEHOLDER_ANSWER;
}

function buildLeadForStorage(leadData) {
  return {
    telegram_id: leadData.telegramId,
    username: leadData.username,
    name: leadData.name,
    business_type: leadData.businessType,
    tariff: leadData.tariff,
    task_description: leadData.taskDescription,
    employees_count: leadData.employeesCount,
    contact: leadData.contact,
    status: "new",
    ai_summary: null,
    recommended_tariff: null,
  };
}

function formatLeadForManager(lead) {
  return [
    "Новая заявка в боте:",
    `ID: ${lead.id}`,
    `Telegram ID: ${lead.telegram_id}`,
    `Username: ${lead.username || "-"}`,
    `Имя: ${lead.name || "-"}`,
    `Тип бизнеса: ${lead.business_type}`,
    `Тариф: ${lead.tariff}`,
    `Задача: ${lead.task_description}`,
    `Сотрудники: ${lead.employees_count}`,
    `Контакт: ${lead.contact}`,
    `Создана: ${lead.created_at}`,
    `Статус: ${lead.status}`,
  ].join("\n");
}

async function notifyManagerIfNeeded(lead) {
  if (!MANAGER_CHAT_ID) {
    return;
  }

  try {
    await bot.telegram.sendMessage(MANAGER_CHAT_ID, formatLeadForManager(lead));
  } catch (error) {
    console.error("Cannot send manager notification:", error);
  }
}

bot.start(async (ctx) => {
  clearUserState(String(ctx.from.id));
  await ctx.reply(
    "Привет! Я помогу оставить заявку на подключение SaaS-системы.",
    mainMenuKeyboard(),
  );
});

bot.command("cancel", async (ctx) => {
  const userId = String(ctx.from.id);
  const state = getUserState(userId);

  if (!state) {
    await ctx.reply("Сейчас нечего отменять.", mainMenuKeyboard());
    return;
  }

  if (state.flow === QUESTION_FLOW) {
    clearUserState(userId);
    await ctx.reply("Вопрос отменен.", mainMenuKeyboard());
    return;
  }

  if (isLeadState(userId)) {
    await cancelLeadFlow(ctx);
  }
});

bot.action(/.*/, async (ctx, next) => {
  let leadResult = false;

  try {
    leadResult = await handleLeadAction(ctx);
  } catch (error) {
    console.error("Lead action error:", error);
    await ctx.answerCbQuery("Ошибка базы данных. Попробуйте еще раз.");
    await ctx.reply("Сейчас есть проблема с базой данных. Попробуйте позже.", mainMenuKeyboard());
    return;
  }

  if (!leadResult) {
    return next();
  }

  if (leadResult.confirmed) {
    const userId = String(ctx.from.id);

    try {
      const leadToInsert = buildLeadForStorage(leadResult.leadData);
      const savedLead = createLead(leadToInsert);
      clearUserState(userId);

      await ctx.reply("Спасибо! Ваша заявка принята.", mainMenuKeyboard());
      await notifyManagerIfNeeded(savedLead);
    } catch (error) {
      console.error("Cannot save lead:", error);
      const currentState = getUserState(userId);

      if (currentState?.flow === "lead") {
        setUserState(userId, { ...currentState, isFinalized: false });
      }

      await ctx.reply(
        "Не удалось сохранить заявку из-за ошибки базы данных. Попробуйте подтвердить еще раз.",
        mainMenuKeyboard(),
      );
    }
  }
});

bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const text = normalizeText(ctx.message.text);
  const state = getUserState(userId);

  if (isCancelInput(text)) {
    if (!state) {
      await ctx.reply("Сейчас нечего отменять.", mainMenuKeyboard());
      return;
    }

    if (isLeadState(userId)) {
      await cancelLeadFlow(ctx);
      return;
    }

    clearUserState(userId);
    await ctx.reply("Действие отменено.", mainMenuKeyboard());
    return;
  }

  if (isLeadState(userId)) {
    try {
      await handleLeadTextInput(ctx);
    } catch (error) {
      console.error("Lead text input error:", error);
      await ctx.reply("Сейчас есть проблема с базой данных. Попробуйте позже.", mainMenuKeyboard());
    }
    return;
  }

  if (state?.flow === QUESTION_FLOW && state.step === QUESTION_STEP) {
    await ctx.reply(buildQuestionAnswer(), mainMenuKeyboard());
    clearUserState(userId);
    return;
  }

  if (text === MAIN_MENU_BUTTONS.CREATE_LEAD) {
    try {
      await startLeadFlow(ctx);
    } catch (error) {
      console.error("Start lead flow error:", error);
      await ctx.reply("Сейчас есть проблема с базой данных. Попробуйте позже.", mainMenuKeyboard());
    }
    return;
  }

  if (text === MAIN_MENU_BUTTONS.VIEW_TARIFFS) {
    try {
      await ctx.reply(formatTariffs(), mainMenuKeyboard());
    } catch (error) {
      console.error("View tariffs error:", error);
      await ctx.reply("Сейчас есть проблема с базой данных. Попробуйте позже.", mainMenuKeyboard());
    }
    return;
  }

  if (text === MAIN_MENU_BUTTONS.ASK_QUESTION) {
    setUserState(userId, { flow: QUESTION_FLOW, step: QUESTION_STEP });
    await ctx.reply("Напишите ваш вопрос одним сообщением.", cancelKeyboard());
    return;
  }

  await ctx.reply(
    "Я не понял команду. Используйте кнопки меню ниже или /start.",
    mainMenuKeyboard(),
  );
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

try {
  initDb();
} catch (error) {
  console.error("Database initialization error:", error);
}

bot
  .launch()
  .then(() => {
    console.log("Bot is running");
  })
  .catch((error) => {
    console.error("Cannot launch bot:", error);
    process.exit(1);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
