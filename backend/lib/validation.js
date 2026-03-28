/**
 * Правила валидации входных данных (create/update из backend/lib):
 * — Строки: trim; обязательные через assert*; длины по полям ниже.
 * — email: assertEmail / optionalEmail, до 254 символов, формат с @ и доменом.
 * — phone: assertPhone, до 32 символов, не меньше 10 цифр после удаления нецифровых.
 * — id: положительное целое; UUID — для plans.
 * — slug: латиница, цифры, дефисы, до 80 символов.
 * — дата: YYYY-MM-DD; время слота: H:MM или HH:MM.
 * — статус записи: pending | confirmed | completed | cancelled | no_show.
 * — числа: duration и счётчики — положительные целые; price, total_spent, rating — ≥ 0; rating ≤ 5.
 * — tags: массив строк, до 50 штук, каждая до 64 символов.
 * — service_ids (staff): массив id, до 200 элементов.
 * Ошибки: code validation_error, HTTP 400 (см. ApiError в errors.js).
 */
import { ApiError } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message, field) {
  throw new ApiError(message, { field, code: 'validation_error', status: 400 });
}

/** Теги: массив строк, каждая не длиннее maxTag, не больше maxCount штук */
export function assertTagsArray(value, field = 'tags', maxCount = 50, maxTagLen = 64) {
  if (value == null) return [];
  if (!Array.isArray(value)) badRequest(`Поле «${field}» должно быть массивом`, field);
  if (value.length > maxCount) {
    badRequest(`Поле «${field}»: не больше ${maxCount} элементов`, field);
  }
  return value.map((t, i) => {
    const s = typeof t === 'string' ? t.trim() : String(t ?? '').trim();
    if (s.length > maxTagLen) {
      badRequest(`Поле «${field}»: элемент ${i + 1} слишком длинный`, field);
    }
    return s;
  }).filter(Boolean);
}

export function assertNonEmptyString(value, field, maxLen = 5000) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) badRequest(`Поле «${field}» обязательно`, field);
  if (s.length > maxLen) badRequest(`Поле «${field}» слишком длинное (макс. ${maxLen})`, field);
  return s;
}

export function optionalEmail(value, field = 'email') {
  if (value == null || String(value).trim() === '') return null;
  const s = String(value).trim();
  if (s.length > 254) badRequest('Email слишком длинный', field);
  if (!EMAIL_RE.test(s)) badRequest('Некорректный email', field);
  return s;
}

export function optionalString(value, field, maxLen) {
  if (value == null) return null;
  const s = String(value).trim();
  if (maxLen && s.length > maxLen) badRequest(`Поле «${field}» слишком длинное`, field);
  return s || null;
}

export function assertPhone(value, field = 'phone') {
  const s = assertNonEmptyString(value, field, 32);
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10) badRequest('Укажите корректный телефон', field);
  return s;
}

export function assertPositiveInt(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || Math.floor(n) !== n) {
    badRequest(`Поле «${field}» должно быть положительным целым числом`, field);
  }
  return n;
}

export function assertNonNegativeNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    badRequest(`Поле «${field}» не может быть отрицательным`, field);
  }
  return n;
}

/** Рейтинг 0–5 (дробный допускается) */
export function assertRatingOptional(value, field = 'rating') {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 5) {
    badRequest(`Поле «${field}» от 0 до 5`, field);
  }
  return n;
}

export function assertId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || Math.floor(n) !== n) {
    badRequest(`Некорректный идентификатор «${field}»`, field);
  }
  return n;
}

export function assertUuid(value, field = 'id') {
  const s = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    badRequest(`Некорректный идентификатор «${field}»`, field);
  }
  return s;
}

export function assertEmail(value, field = 'email') {
  const s = assertNonEmptyString(value, field, 254);
  if (!EMAIL_RE.test(s)) badRequest('Некорректный email', field);
  return s.toLowerCase();
}

export function assertPassword(value, field = 'password') {
  const s = typeof value === 'string' ? value : '';
  if (s.length < 8) badRequest('Пароль не короче 8 символов', field);
  if (s.length > 128) badRequest('Пароль слишком длинный', field);
  return s;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertSlug(value, field = 'slug') {
  const s = assertNonEmptyString(value, field, 80).toLowerCase();
  if (!SLUG_RE.test(s)) badRequest('Slug: только латиница, цифры и дефисы', field);
  return s;
}

export function assertDateIso(value, field = 'date') {
  const s = assertNonEmptyString(value, field, 12);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) badRequest('Дата должна быть в формате ГГГГ-ММ-ДД', field);
  return s;
}

export function assertTimeSlot(value, field = 'time') {
  const s = assertNonEmptyString(value, field, 8);
  if (!/^\d{1,2}:\d{2}$/.test(s)) badRequest('Время в формате ЧЧ:ММ', field);
  return s;
}

export function assertAppointmentStatus(value, field = 'status') {
  const allowed = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']);
  const s = assertNonEmptyString(value, field, 32);
  if (!allowed.has(s)) badRequest('Некорректный статус записи', field);
  return s;
}
