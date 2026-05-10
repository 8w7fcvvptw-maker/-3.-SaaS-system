import { NAVIGATION_ITEMS, confirmKeyboard, optionsKeyboard, textInputKeyboard } from "../keyboards.js";
import { isPositiveInteger, isValidContact, isValidTaskDescription } from "../utils/validators.js";

const STEPS = {
  businessType: "businessType",
  tariff: "tariff",
  taskDescription: "taskDescription",
  employeesCount: "employeesCount",
  contact: "contact",
  confirmation: "confirmation",
};

function createEmptyDraft(user) {
  return {
    telegram_id: String(user.id),
    username: user.username || null,
    name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || null,
    business_type: null,
    tariff: null,
    task_description: null,
    employees_count: null,
    contact: null,
    status: "new",
    ai_summary: null,
    lead_score: null,
    recommended_tariff: null,
    created_at: new Date().toISOString(),
  };
}

export function createLeadScene(dependencies) {
  const { getBusinessTypes, getTariffs, createLead } = dependencies;
  const stateByUserId = new Map();

  function getState(userId) {
    return stateByUserId.get(userId) || null;
  }

  function resetState(userId) {
    stateByUserId.delete(userId);
  }

  async function start(ctx) {
    const userId = String(ctx.from.id);
    const businessTypes = await getBusinessTypes();
    if (businessTypes.length === 0) {
      await ctx.reply(
        "Не удалось получить список типов бизнеса. Попробуйте позже. Если ошибка повторяется — проверьте подключение к Supabase.",
      );
      return;
    }

    stateByUserId.set(userId, {
      step: STEPS.businessType,
      history: [],
      submitted: false,
      availableBusinessTypes: businessTypes,
      availableTariffs: [],
      draft: createEmptyDraft(ctx.from),
    });

    await ctx.reply("Выберите тип бизнеса:", optionsKeyboard(businessTypes));
  }

  async function handleBack(ctx, state) {
    if (state.history.length === 0) {
      await ctx.reply("Вы уже на первом шаге. Выберите тип бизнеса:", optionsKeyboard(state.availableBusinessTypes));
      return;
    }

    const previousStep = state.history.pop();
    state.step = previousStep;
    if (previousStep === STEPS.businessType) {
      await ctx.reply("Вернулись к выбору типа бизнеса:", optionsKeyboard(state.availableBusinessTypes));
      return;
    }
    if (previousStep === STEPS.tariff) {
      if (state.availableTariffs.length === 0) {
        const tariffs = await getTariffs();
        state.availableTariffs = tariffs.map((item) => item.name).filter(Boolean);
      }
      await ctx.reply("Вернулись к выбору тарифа:", optionsKeyboard(state.availableTariffs));
      return;
    }
    if (previousStep === STEPS.taskDescription) {
      await ctx.reply("Введите описание задачи (минимум 10 символов):", textInputKeyboard());
      return;
    }
    if (previousStep === STEPS.employeesCount) {
      await ctx.reply("Укажите количество сотрудников (целое число):", textInputKeyboard());
      return;
    }
    if (previousStep === STEPS.contact) {
      await ctx.reply("Укажите контакт для связи (телефон/Telegram/email):", textInputKeyboard());
      return;
    }
  }

  async function handleCancellation(ctx) {
    const userId = String(ctx.from.id);
    resetState(userId);
    await ctx.reply("Заявка отменена. Вы можете начать заново в любой момент.");
  }

  async function showConfirmation(ctx, state) {
    const summary = [
      "Проверьте заявку перед отправкой:",
      `Тип бизнеса: ${state.draft.business_type}`,
      `Тариф: ${state.draft.tariff}`,
      `Описание: ${state.draft.task_description}`,
      `Сотрудников: ${state.draft.employees_count}`,
      `Контакт: ${state.draft.contact}`,
    ].join("\n");
    await ctx.reply(summary, confirmKeyboard());
  }

  async function handleInput(ctx, text) {
    const userId = String(ctx.from.id);
    const state = getState(userId);
    if (!state) {
      return false;
    }

    if (text === NAVIGATION_ITEMS.cancel) {
      await handleCancellation(ctx);
      return true;
    }

    if (text === NAVIGATION_ITEMS.back) {
      await handleBack(ctx, state);
      return true;
    }

    if (state.step === STEPS.businessType) {
      if (!state.availableBusinessTypes.includes(text)) {
        await ctx.reply("Некорректный тип бизнеса. Выберите вариант из кнопок.", optionsKeyboard(state.availableBusinessTypes));
        return true;
      }
      state.draft.business_type = text;
      state.history.push(STEPS.businessType);
      state.step = STEPS.tariff;
      const tariffs = await getTariffs();
      state.availableTariffs = tariffs.map((item) => item.name).filter(Boolean);
      if (state.availableTariffs.length === 0) {
        await ctx.reply("Не удалось загрузить тарифы. Попробуйте позже.");
        return true;
      }
      await ctx.reply("Выберите тариф:", optionsKeyboard(state.availableTariffs));
      return true;
    }

    if (state.step === STEPS.tariff) {
      if (!state.availableTariffs.includes(text)) {
        await ctx.reply("Некорректный тариф. Выберите вариант из кнопок.", optionsKeyboard(state.availableTariffs));
        return true;
      }
      state.draft.tariff = text;
      state.history.push(STEPS.tariff);
      state.step = STEPS.taskDescription;
      await ctx.reply("Опишите задачу (минимум 10 символов):", textInputKeyboard());
      return true;
    }

    if (state.step === STEPS.taskDescription) {
      if (!isValidTaskDescription(text)) {
        await ctx.reply("Описание слишком короткое. Введите минимум 10 символов.");
        return true;
      }
      state.draft.task_description = text.trim();
      state.history.push(STEPS.taskDescription);
      state.step = STEPS.employeesCount;
      await ctx.reply("Укажите количество сотрудников (целое число):", textInputKeyboard());
      return true;
    }

    if (state.step === STEPS.employeesCount) {
      if (!isPositiveInteger(text)) {
        await ctx.reply("Некорректное число сотрудников. Введите целое число больше нуля.");
        return true;
      }
      state.draft.employees_count = Number(text);
      state.history.push(STEPS.employeesCount);
      state.step = STEPS.contact;
      await ctx.reply("Укажите контакт для связи (телефон/Telegram/email):", textInputKeyboard());
      return true;
    }

    if (state.step === STEPS.contact) {
      if (!isValidContact(text)) {
        await ctx.reply("Некорректный контакт. Укажите телефон, Telegram или email.");
        return true;
      }
      state.draft.contact = text.trim();
      state.history.push(STEPS.contact);
      state.step = STEPS.confirmation;
      await showConfirmation(ctx, state);
      return true;
    }

    if (state.step === STEPS.confirmation) {
      if (text !== NAVIGATION_ITEMS.confirm) {
        await ctx.reply("Для отправки нажмите «Подтвердить заявку», либо «Назад»/«Отменить».", confirmKeyboard());
        return true;
      }

      if (state.submitted) {
        await ctx.reply("Эта заявка уже отправлена. Чтобы создать новую, начните сценарий заново.");
        return true;
      }

      state.submitted = true;
      const result = await createLead(state.draft);
      if (!result.ok) {
        state.submitted = false;
        await ctx.reply(
          "Не удалось сохранить заявку в Supabase. Попробуйте позже. Если ошибка повторяется — проверьте доступность Supabase.",
        );
        return true;
      }

      await ctx.reply("Заявка успешно отправлена. Менеджер свяжется с вами в ближайшее время.");
      return { handled: true, lead: state.draft };
    }

    return false;
  }

  return {
    start,
    handleInput,
    getState,
    resetState,
  };
}
