import { Markup } from "telegraf";
import { EMPLOYEE_COUNTS, MAIN_MENU_BUTTONS } from "./data/businessData.js";

export function mainMenuKeyboard() {
  return Markup.keyboard([
    [MAIN_MENU_BUTTONS.CREATE_LEAD],
    [MAIN_MENU_BUTTONS.VIEW_TARIFFS, MAIN_MENU_BUTTONS.ASK_QUESTION],
  ]).resize();
}

export function cancelKeyboard() {
  return Markup.keyboard([[MAIN_MENU_BUTTONS.CANCEL]]).resize();
}

export function leadTextKeyboard() {
  return Markup.keyboard([[MAIN_MENU_BUTTONS.BACK, MAIN_MENU_BUTTONS.CANCEL]]).resize();
}

export function businessTypeKeyboard(businessTypes) {
  const rows = businessTypes.map((type) => [Markup.button.callback(type.title, `lead_business:${type.id}`)]);
  rows.push([
    Markup.button.callback(MAIN_MENU_BUTTONS.BACK, "lead_back"),
    Markup.button.callback(MAIN_MENU_BUTTONS.CANCEL, "lead_cancel"),
  ]);
  return Markup.inlineKeyboard(rows);
}

export function tariffKeyboard(tariffs) {
  const rows = tariffs.map((plan) => [
    Markup.button.callback(`${plan.title} — ${plan.description}`, `lead_plan:${plan.id}`),
  ]);
  rows.push([
    Markup.button.callback(MAIN_MENU_BUTTONS.BACK, "lead_back"),
    Markup.button.callback(MAIN_MENU_BUTTONS.CANCEL, "lead_cancel"),
  ]);
  return Markup.inlineKeyboard(rows);
}

export function employeeCountKeyboard() {
  const rows = EMPLOYEE_COUNTS.map((value) => [Markup.button.callback(value, `lead_employees:${value}`)]);
  rows.push([
    Markup.button.callback(MAIN_MENU_BUTTONS.BACK, "lead_back"),
    Markup.button.callback(MAIN_MENU_BUTTONS.CANCEL, "lead_cancel"),
  ]);
  return Markup.inlineKeyboard(rows);
}

export function confirmationKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Подтвердить заявку", "lead_confirm")],
    [
      Markup.button.callback(MAIN_MENU_BUTTONS.BACK, "lead_back"),
      Markup.button.callback(MAIN_MENU_BUTTONS.CANCEL, "lead_cancel"),
    ],
  ]);
}
