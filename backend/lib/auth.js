import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { assertEmail, assertPassword } from './validation.js';
import { normalizeBrowserApiBase } from './browserApiBase.js';

/** В браузере по умолчанию вход/регистрация идут через POST /api/auth/* (rate limit). Отключить: VITE_USE_AUTH_API=false */
function useAuthHttpApi() {
  return (
    typeof window !== 'undefined' &&
    import.meta.env?.VITE_USE_AUTH_API !== 'false'
  );
}

/**
 * URL для POST /api/auth/*:
 * — если задан VITE_SERVER_URL → прямой вызов Railway (нужен CORS / ALLOWED_ORIGINS);
 * — иначе относительный путь → локально Vite proxy, на Vercel — serverless-прокси (см. /api в корне репо + AUTH_API_UPSTREAM).
 */
function authApiUrl(path) {
  const raw = import.meta.env?.VITE_SERVER_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return `${normalizeBrowserApiBase(raw)}${path}`;
  }
  return path;
}

/** @param {string} path `/api/auth/login` или `/api/auth/register` */
async function postAuth(path, email, password) {
  let res;
  try {
    res = await fetch(authApiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError(
      'Не удалось связаться с сервером входа. На Vercel: задайте AUTH_API_UPSTREAM (URL Railway) и оставьте VITE_SERVER_URL пустым для прокси; либо укажите VITE_SERVER_URL с https:// и ALLOWED_ORIGINS на Railway.',
      { code: 'network_error', status: 503 },
    );
  }
  let body = {};
  try {
    body = await res.json();
  } catch (_) {}
  if (res.status === 429) {
    throw new ApiError(
      body.message ||
        'Слишком много попыток за 15 минут. Подождите и попробуйте снова.',
      { code: 'rate_limit', status: 429 },
    );
  }
  if (!res.ok) {
    throw new ApiError(body.message || 'Ошибка запроса', {
      code: body.code || 'auth_failed',
      status: res.status,
      field: body.field,
    });
  }
  if (body.session?.access_token && body.session?.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: body.session.access_token,
      refresh_token: body.session.refresh_token,
    });
    if (error) {
      throw new ApiError(error.message || 'Не удалось установить сессию', {
        code: 'auth_failed',
        status: 401,
      });
    }
  }
  return { session: body.session ?? null, user: body.user ?? null };
}

/** Регистрация email + пароль (хеш и хранение — только Supabase Auth). */
export async function registerWithEmail(email, password) {
  return signUpWithEmail(email, password);
}

/** Вход email + пароль. */
export async function loginWithEmail(email, password) {
  return signInWithEmail(email, password);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new ApiError(error.message || 'Ошибка сессии', { code: 'auth_required', status: 401 });
  }
  return data.session;
}

export async function signInWithEmail(email, password) {
  const e = assertEmail(email);
  const p = assertPassword(password);
  if (useAuthHttpApi()) {
    return postAuth('/api/auth/login', e, p);
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email: e, password: p });
  if (error) throw new ApiError(error.message || 'Не удалось войти', { code: 'auth_failed', status: 401 });
  return data;
}

export async function signUpWithEmail(email, password) {
  const e = assertEmail(email);
  const p = assertPassword(password);
  if (useAuthHttpApi()) {
    return postAuth('/api/auth/register', e, p);
  }
  const { data, error } = await supabase.auth.signUp({ email: e, password: p });
  if (error) {
    throw new ApiError(error.message || 'Не удалось зарегистрироваться', { code: 'signup_failed', status: 400 });
  }
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new ApiError(error.message || 'Не удалось выйти', { code: 'signout_failed', status: 400 });
}

export async function resetPasswordForEmail(email) {
  assertEmail(email);
  const redirectTo =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/login`
      : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) throw new ApiError(error.message || 'Не удалось отправить письмо', { code: 'validation_error', status: 400 });
}

/** Текущий пользователь (null если не вошёл) */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

/** Служебно: войти тестовым пользователем (интеграционные тесты) */
export async function signInTestUser() {
  if (import.meta.env?.PROD) return false;
  const email = import.meta.env?.VITE_TEST_USER_EMAIL;
  const password = import.meta.env?.VITE_TEST_USER_PASSWORD;
  if (!email || !password) return false;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

/** Обёртка для вызовов только из кабинета */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new ApiError('Требуется войти в аккаунт', { code: 'auth_required', status: 401 });
  }
  return session;
}

export async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError('Требуется войти в аккаунт', { code: 'auth_required', status: 401 });
  }
  return data.user;
}
