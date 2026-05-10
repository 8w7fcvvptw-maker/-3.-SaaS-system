import { Telegraf } from "telegraf";
import express from "express";
import { config } from "./config.js";
import { MAIN_MENU_ITEMS, mainMenuKeyboard } from "./keyboards.js";
import { createLeadScene } from "./scenes/leadScene.js";
import { getBusinessTypes } from "./repositories/businessTypesRepository.js";
import { getTariffs } from "./repositories/tariffsRepository.js";
import { createLead } from "./repositories/leadsRepository.js";
import { checkSupabaseConnection } from "./supabaseClient.js";
import { answerUserQuestion } from "./llm/aiAnswerService.js";

const bot = new Telegraf(config.telegramBotToken);

/** Пользователи, нажавшие «Задать вопрос» и ожидающие текст вопроса (LLM не используется в сценарии заявки). */
const questionModeUserIds = new Set();

function clearQuestionMode(userId) {
  questionModeUserIds.delete(userId);
}

function enableQuestionMode(userId) {
  questionModeUserIds.add(userId);
}
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
  const userId = String(ctx.from.id);
  clearQuestionMode(userId);
  leadScene.resetState(userId);
  await ctx.reply(
    "Привет! Я помогу оставить заявку на подключение SaaS-системы.",
    mainMenuKeyboard(),
  );
});

bot.hears(MAIN_MENU_ITEMS.leaveLead, async (ctx) => {
  clearQuestionMode(String(ctx.from.id));
  await leadScene.start(ctx);
});

bot.hears(MAIN_MENU_ITEMS.viewTariffs, async (ctx) => {
  clearQuestionMode(String(ctx.from.id));
  const tariffs = await getTariffs();
  await ctx.reply(formatTariffsMessage(tariffs), mainMenuKeyboard());
});

bot.hears(MAIN_MENU_ITEMS.askQuestion, async (ctx) => {
  const userId = String(ctx.from.id);
  enableQuestionMode(userId);
  await ctx.reply(
    "Напишите ваш вопрос одним сообщением — ответит AI-консультант. Для других действий используйте кнопки меню ниже.",
    mainMenuKeyboard(),
  );
});

bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const input = ctx.message.text.trim();

  const result = await leadScene.handleInput(ctx, input);
  if (result) {
    clearQuestionMode(userId);
    if (typeof result === "object" && result.lead) {
      await notifyManagerAboutLead(ctx, result.lead);
      leadScene.resetState(userId);
      await showMainMenu(ctx);
    }
    return;
  }

  if (questionModeUserIds.has(userId)) {
    await ctx.sendChatAction("typing");
    const replyText = await answerUserQuestion({
      openaiApiKey: config.openaiApiKey,
      userMessage: input,
    });
    await ctx.reply(replyText, mainMenuKeyboard());
    return;
  }

  await ctx.reply("Выберите действие из главного меню.", mainMenuKeyboard());
});

bot.catch((error) => {
  console.error("[telegram] Unhandled bot error:", error);
});

const isSupabaseAvailable = await checkSupabaseConnection();
if (!isSupabaseAvailable) {
  console.error("[startup] Bot started, but Supabase connectivity check failed.");
}

const webhookPath = "/telegram/webhook";
const shouldUseWebhook = config.nodeEnv === "production" && Boolean(config.webhookUrl);

if (shouldUseWebhook) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(webhookPath, async (req, res) => {
    if (config.telegramWebhookSecret) {
      const secretHeader = req.header("x-telegram-bot-api-secret-token");
      if (secretHeader !== config.telegramWebhookSecret) {
        res.sendStatus(403);
        return;
      }
    }

    try {
      await bot.handleUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error("[webhook] Failed to process Telegram update:", error);
      res.sendStatus(500);
    }
  });

  const normalizedWebhookUrl = config.webhookUrl.replace(/\/+$/, "");
  const fullWebhookUrl = `${normalizedWebhookUrl}${webhookPath}`;
  await bot.telegram.setWebhook(fullWebhookUrl, {
    secret_token: config.telegramWebhookSecret || undefined,
  });

  app.listen(config.port, () => {
    console.log(
      `[startup] Telegram bot is running in webhook mode on port ${config.port}. Webhook: ${fullWebhookUrl}`,
    );
  });
} else {
  if (config.resetWebhookOnLocalStart) {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    console.log("[startup] Existing Telegram webhook was removed for local start.");
  }
  await bot.launch();
  console.log("[startup] Telegram bot is running in long polling mode.");
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
