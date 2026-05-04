import { MAIN_MENU_BUTTONS } from "../data/businessData.js";

export function normalizeText(value) {
  return (value ?? "").trim();
}

export function isCancelInput(value) {
  return normalizeText(value).toLowerCase() === MAIN_MENU_BUTTONS.CANCEL.toLowerCase();
}

export function isBackInput(value) {
  return normalizeText(value).toLowerCase() === MAIN_MENU_BUTTONS.BACK.toLowerCase();
}

export function isNonEmptyText(value) {
  return normalizeText(value).length > 0;
}

export function isValidContact(value) {
  const text = normalizeText(value);

  if (text.length < 3 || text.length > 100) {
    return false;
  }

  return /[@+0-9a-zA-Zа-яА-Я]/.test(text);
}
