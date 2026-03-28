const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @returns {string|null} текст ошибки или null */
export function validateLoginEmail(value) {
  const s = String(value ?? "").trim();
  if (!s) return "Укажите email";
  if (s.length > 254) return "Email слишком длинный";
  if (!EMAIL_RE.test(s)) return "Некорректный формат email";
  return null;
}

export function validateLoginPassword(value) {
  const s = typeof value === "string" ? value : "";
  if (!s) return "Укажите пароль";
  return null;
}

export function validateRegisterEmail(value) {
  return validateLoginEmail(value);
}

export function validateRegisterPassword(value) {
  const s = typeof value === "string" ? value : "";
  if (!s) return "Укажите пароль";
  if (s.length < 8) return "Пароль не короче 8 символов";
  if (s.length > 128) return "Пароль слишком длинный";
  return null;
}

export function validatePasswordRepeat(password, password2) {
  const a = typeof password === "string" ? password : "";
  const b = typeof password2 === "string" ? password2 : "";
  if (!b && a) return "Повторите пароль";
  if (a !== b) return "Пароли не совпадают";
  return null;
}
