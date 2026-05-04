import { EMPLOYEE_COUNTS } from "../data/businessData.js";
import {
  businessTypeKeyboard,
  cancelKeyboard,
  confirmationKeyboard,
  employeeCountKeyboard,
  leadTextKeyboard,
  mainMenuKeyboard,
  tariffKeyboard,
} from "../keyboards.js";
import {
  getActiveBusinessTypes,
  getBusinessTypeById,
} from "../repositories/businessTypesRepository.js";
import { getActiveTariffs, getTariffById } from "../repositories/tariffsRepository.js";
import { clearUserState, getUserState, setUserState } from "../storage/memoryStorage.js";
import { isBackInput, isNonEmptyText, isValidContact, normalizeText } from "../utils/validators.js";

const LEAD_FLOW = "lead";

export const LEAD_STEPS = {
  BUSINESS_TYPE: "business_type",
  PLAN: "plan",
  TASK_DESCRIPTION: "task_description",
  EMPLOYEE_COUNT: "employee_count",
  CONTACT: "contact",
  CONFIRMATION: "confirmation",
};

function createDraft(from) {
  return {
    telegramId: String(from.id),
    username: from.username ?? "",
    name: from.first_name ?? "",
    businessType: "",
    businessTypeId: null,
    tariff: "",
    tariffId: null,
    taskDescription: "",
    employeesCount: "",
    contact: "",
  };
}

function formatLeadPreview(data) {
  return [
    "Короткая сводка:",
    `Тип: ${data.businessType}`,
    `Тариф: ${data.tariff}`,
    `Сотрудники: ${data.employeesCount}`,
    `Контакт: ${data.contact}`,
  ].join("\n");
}

function updateLeadState(userId, nextStep, data, isFinalized = false) {
  setUserState(userId, {
    flow: LEAD_FLOW,
    step: nextStep,
    data,
    isFinalized,
  });
}

async function showStepPrompt(ctx, userId, step, data) {
  if (step === LEAD_STEPS.BUSINESS_TYPE) {
    const businessTypes = getActiveBusinessTypes();
    if (businessTypes.length === 0) {
      await ctx.reply("Типы бизнеса пока недоступны.", mainMenuKeyboard());
      return false;
    }

    updateLeadState(userId, LEAD_STEPS.BUSINESS_TYPE, data);
    await ctx.reply("Шаг 1/6. Тип бизнеса:", businessTypeKeyboard(businessTypes));
    return true;
  }

  if (step === LEAD_STEPS.PLAN) {
    const tariffs = getActiveTariffs();
    if (tariffs.length === 0) {
      await ctx.reply("Тарифы пока недоступны.", mainMenuKeyboard());
      return false;
    }

    updateLeadState(userId, LEAD_STEPS.PLAN, data);
    await ctx.reply("Шаг 2/6. Тариф:", tariffKeyboard(tariffs));
    return true;
  }

  if (step === LEAD_STEPS.TASK_DESCRIPTION) {
    updateLeadState(userId, LEAD_STEPS.TASK_DESCRIPTION, data);
    await ctx.reply("Шаг 3/6. Опишите задачу:", leadTextKeyboard());
    return true;
  }

  if (step === LEAD_STEPS.EMPLOYEE_COUNT) {
    updateLeadState(userId, LEAD_STEPS.EMPLOYEE_COUNT, data);
    await ctx.reply("Шаг 4/6. Сотрудники:", employeeCountKeyboard());
    return true;
  }

  if (step === LEAD_STEPS.CONTACT) {
    updateLeadState(userId, LEAD_STEPS.CONTACT, data);
    await ctx.reply("Шаг 5/6. Контакт:", leadTextKeyboard());
    return true;
  }

  if (step === LEAD_STEPS.CONFIRMATION) {
    updateLeadState(userId, LEAD_STEPS.CONFIRMATION, data);
    await ctx.reply(`Шаг 6/6.\n${formatLeadPreview(data)}`, confirmationKeyboard());
    return true;
  }

  return false;
}

async function moveToPreviousStep(ctx, userId, state) {
  if (state.step === LEAD_STEPS.BUSINESS_TYPE) {
    await ctx.reply("Вы уже на первом шаге.");
    return true;
  }

  if (state.step === LEAD_STEPS.PLAN) {
    return showStepPrompt(ctx, userId, LEAD_STEPS.BUSINESS_TYPE, state.data);
  }

  if (state.step === LEAD_STEPS.TASK_DESCRIPTION) {
    return showStepPrompt(ctx, userId, LEAD_STEPS.PLAN, state.data);
  }

  if (state.step === LEAD_STEPS.EMPLOYEE_COUNT) {
    return showStepPrompt(ctx, userId, LEAD_STEPS.TASK_DESCRIPTION, state.data);
  }

  if (state.step === LEAD_STEPS.CONTACT) {
    return showStepPrompt(ctx, userId, LEAD_STEPS.EMPLOYEE_COUNT, state.data);
  }

  if (state.step === LEAD_STEPS.CONFIRMATION) {
    return showStepPrompt(ctx, userId, LEAD_STEPS.CONTACT, state.data);
  }

  return false;
}

export async function startLeadFlow(ctx) {
  const userId = String(ctx.from.id);
  const draft = createDraft(ctx.from);
  await ctx.reply("Начинаем оформление заявки.", cancelKeyboard());
  await showStepPrompt(ctx, userId, LEAD_STEPS.BUSINESS_TYPE, draft);
}

export async function cancelLeadFlow(ctx) {
  const userId = String(ctx.from.id);
  clearUserState(userId);
  await ctx.reply("Заполнение заявки отменено.", mainMenuKeyboard());
}

export function isLeadState(userId) {
  const state = getUserState(userId);
  return Boolean(state && state.flow === LEAD_FLOW);
}

export async function handleLeadTextInput(ctx) {
  const userId = String(ctx.from.id);
  const state = getUserState(userId);

  if (!state || state.flow !== LEAD_FLOW) {
    return false;
  }

  const text = normalizeText(ctx.message?.text);

  if (isBackInput(text)) {
    await moveToPreviousStep(ctx, userId, state);
    return true;
  }

  switch (state.step) {
    case LEAD_STEPS.BUSINESS_TYPE:
    case LEAD_STEPS.PLAN:
    case LEAD_STEPS.EMPLOYEE_COUNT:
    case LEAD_STEPS.CONFIRMATION:
      await ctx.reply("Нажмите кнопку ниже.");
      return true;
    case LEAD_STEPS.TASK_DESCRIPTION: {
      if (!isNonEmptyText(text)) {
        await ctx.reply("Введите текст задачи.");
        return true;
      }

      const nextData = { ...state.data, taskDescription: text };
      await showStepPrompt(ctx, userId, LEAD_STEPS.EMPLOYEE_COUNT, nextData);
      return true;
    }
    case LEAD_STEPS.CONTACT: {
      if (!isValidContact(text)) {
        await ctx.reply("Введите контакт: телефон, @username или email.");
        return true;
      }

      const nextData = { ...state.data, contact: text };
      await showStepPrompt(ctx, userId, LEAD_STEPS.CONFIRMATION, nextData);
      return true;
    }
    default:
      return false;
  }
}

export async function handleLeadAction(ctx) {
  const data = ctx.callbackQuery?.data ?? "";
  const userId = String(ctx.from.id);
  const state = getUserState(userId);

  if (!state || state.flow !== LEAD_FLOW) {
    if (data.startsWith("lead_")) {
      await ctx.answerCbQuery("Сессия устарела");
      await ctx.reply(
        "После перезапуска продолжить старую заявку нельзя. Нажмите «Оставить заявку» и заполните заново.",
        mainMenuKeyboard(),
      );
      return true;
    }

    return false;
  }

  if (data === "lead_cancel") {
    clearUserState(userId);
    await ctx.answerCbQuery("Заявка отменена.");
    await ctx.reply("Заполнение заявки отменено.", mainMenuKeyboard());
    return true;
  }

  if (data === "lead_back") {
    await ctx.answerCbQuery("Назад");
    await moveToPreviousStep(ctx, userId, state);
    return true;
  }

  if (data.startsWith("lead_business:")) {
    if (state.step !== LEAD_STEPS.BUSINESS_TYPE) {
      await ctx.answerCbQuery("Сначала завершите текущий шаг.");
      return true;
    }

    const selectedTypeId = Number(data.replace("lead_business:", ""));
    if (!Number.isFinite(selectedTypeId)) {
      await ctx.answerCbQuery("Неизвестный тип бизнеса.");
      return true;
    }

    const selectedType = getBusinessTypeById(selectedTypeId);
    if (!selectedType) {
      await ctx.answerCbQuery("Неизвестный тип бизнеса.");
      return true;
    }

    const nextData = {
      ...state.data,
      businessTypeId: selectedType.id,
      businessType: selectedType.title,
    };

    await ctx.answerCbQuery("Тип выбран.");
    await showStepPrompt(ctx, userId, LEAD_STEPS.PLAN, nextData);
    return true;
  }

  if (data.startsWith("lead_plan:")) {
    if (state.step !== LEAD_STEPS.PLAN) {
      await ctx.answerCbQuery("Сначала завершите текущий шаг.");
      return true;
    }

    const selectedPlan = data.replace("lead_plan:", "");
    const selectedTariff = getTariffById(selectedPlan);
    if (!selectedTariff) {
      await ctx.answerCbQuery("Неизвестный тариф.");
      return true;
    }

    const nextData = {
      ...state.data,
      tariffId: selectedTariff.id,
      tariff: `${selectedTariff.title} — ${selectedTariff.description}`,
    };

    await ctx.answerCbQuery("Тариф выбран.");
    await showStepPrompt(ctx, userId, LEAD_STEPS.TASK_DESCRIPTION, nextData);
    return true;
  }

  if (data.startsWith("lead_employees:")) {
    if (state.step !== LEAD_STEPS.EMPLOYEE_COUNT) {
      await ctx.answerCbQuery("Сначала завершите текущий шаг.");
      return true;
    }

    const selectedCount = data.replace("lead_employees:", "");
    if (!EMPLOYEE_COUNTS.includes(selectedCount)) {
      await ctx.answerCbQuery("Неизвестный вариант.");
      return true;
    }

    const nextData = { ...state.data, employeesCount: selectedCount };
    await ctx.answerCbQuery("Выбрано.");
    await showStepPrompt(ctx, userId, LEAD_STEPS.CONTACT, nextData);
    return true;
  }

  if (data === "lead_confirm") {
    if (state.step !== LEAD_STEPS.CONFIRMATION) {
      await ctx.answerCbQuery("Сначала завершите текущий шаг.");
      return true;
    }

    if (state.isFinalized) {
      await ctx.answerCbQuery("Эта заявка уже подтверждена.");
      return true;
    }

    updateLeadState(userId, LEAD_STEPS.CONFIRMATION, state.data, true);
    await ctx.answerCbQuery("Заявка подтверждена.");
    return {
      confirmed: true,
      leadData: state.data,
    };
  }

  return false;
}
