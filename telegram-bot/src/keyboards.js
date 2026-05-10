import { Markup } from "telegraf";

export const MAIN_MENU_ITEMS = {
  leaveLead: "Оставить заявку",
  viewTariffs: "Посмотреть тарифы",
  askQuestion: "Задать вопрос",
};

export const NAVIGATION_ITEMS = {
  back: "Назад",
  cancel: "Отменить",
  confirm: "Подтвердить заявку",
};

export function mainMenuKeyboard() {
  return Markup.keyboard([
    [MAIN_MENU_ITEMS.leaveLead],
    [MAIN_MENU_ITEMS.viewTariffs],
    [MAIN_MENU_ITEMS.askQuestion],
  ])
    .resize()
    .persistent();
}

export function optionsKeyboard(options) {
  const rows = options.map((option) => [option]);
  rows.push([NAVIGATION_ITEMS.back, NAVIGATION_ITEMS.cancel]);
  return Markup.keyboard(rows).resize();
}

export function textInputKeyboard() {
  return Markup.keyboard([[NAVIGATION_ITEMS.back, NAVIGATION_ITEMS.cancel]]).resize();
}

export function confirmKeyboard() {
  return Markup.keyboard([[NAVIGATION_ITEMS.confirm], [NAVIGATION_ITEMS.back, NAVIGATION_ITEMS.cancel]]).resize();
}
