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

function isNetworkAuthApiError(error) {
  return error instanceof ApiError && error.code === 'network_error';
}

function isRecoverableAuthApiError(error) {
  if (!(error instanceof ApiError)) return false;
  if (isNetworkAuthApiError(error)) return true;
  return (
    error.code === 'cors_forbidden' ||
    error.code === 'proxy_misconfigured' ||
    error.code === 'upstream_unreachable'
  );
}

/**
 * URL для POST /api/auth/*:
 * — если задан VITE_SERVER_URL → прямой вызов Railway (нужен CORS / ALLOWED_ORIGINS);
 * — иначе относительный путь → локально Vite proxy, на Vercel — serverless-прокси (папки `api/` в корне репо и `frontend/api/` + AUTH_API_UPSTREAM).
 */
function authApiUrl(path) {
  const raw = import.meta.env?.VITE_SERVER_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return `${normalizeBrowserApiBase(raw)}${path}`;
  }
  return path;
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const isBrowser =
  typeof globalThis !== 'undefined' &&
  typeof globalThis.window !== 'undefined' &&
  typeof globalThis.document !== 'undefined';

/**
 * Сразу после signIn иногда getSession() ещё не отдаёт user.id (гонка localStorage + первые запросы),
 * а getUser() уже видит сессию. Без мягкого ожидания getBusiness() мог бросать 401 → signOut (AuthApiBridge).
 */
export async function waitForSessionUserId(maxAttempts = isBrowser ? 20 : 1) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      throw new ApiError(sessionErr.message || 'Ошибка сессии', { code: 'auth_required', status: 401 });
    }
    const id = sessionData.session?.user?.id;
    if (id) return id;

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (!userErr && userData.user?.id) return userData.user.id;

    if (attempt < maxAttempts - 1) {
      await sleepMs(isBrowser ? 25 : 0);
    }
  }
  return null;
}

/** @param {string} path `/api/auth/login` или `/api/auth/register` */
async function postAuth(path, email, password) {
  const url = authApiUrl(path);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    const proxyHint =
      import.meta.env.PROD && url.startsWith('/')
        ? ' Проверьте в Vercel → Settings → General: Root Directory «frontend» или пусто — в репо есть и frontend/api/, и корневой api/. После правок — Redeploy. Нужны AUTH_API_UPSTREAM (Production) и пустой VITE_SERVER_URL для прокси.'
        : '';
    throw new ApiError(
      `Не удалось связаться с сервером входа.${proxyHint} Либо задайте VITE_SERVER_URL (https://… Railway) и ALLOWED_ORIGINS на Railway.`,
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
      let msg = error.message || 'Не удалось установить сессию';
      if (/fetch|network|failed to reach/i.test(String(msg))) {
        msg +=
          ' Проверьте в Vercel переменные VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY, отключите блокировщики для supabase.co, в Supabase Dashboard → Authentication → URL Configuration добавьте ваш домен Vercel в Redirect URLs / Site URL при необходимости.';
      }
      throw new ApiError(msg, {
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
  if (data.session && !data.session.user?.id) {
    const id = await waitForSessionUserId(2);
    if (id) {
      const { data: next, error: nextErr } = await supabase.auth.getSession();
      if (nextErr) {
        throw new ApiError(nextErr.message || 'Ошибка сессии', { code: 'auth_required', status: 401 });
      }
      return next.session;
    }
  }
  return data.session;
}

export async function signInWithEmail(email, password) {
  const e = assertEmail(email);
  const p = assertPassword(password);
  if (useAuthHttpApi()) {
    try {
      return await postAuth('/api/auth/login', e, p);
    } catch (error) {
      // Fallback keeps login available when /api proxy or upstream auth API is unreachable/misconfigured.
      if (!isRecoverableAuthApiError(error)) throw error;
    }
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email: e, password: p });
  if (error) throw new ApiError(error.message || 'Не удалось войти', { code: 'auth_failed', status: 401 });
  return data;
}

export async function signUpWithEmail(email, password) {
  const e = assertEmail(email);
  const p = assertPassword(password);
  if (useAuthHttpApi()) {
    try {
      return await postAuth('/api/auth/register', e, p);
    } catch (error) {
      // Fallback keeps registration available when /api proxy or upstream auth API is unreachable/misconfigured.
      if (!isRecoverableAuthApiError(error)) throw error;
    }
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

/** Смена пароля в активной сессии (кабинет владельца). */
export async function changePassword(newPassword) {
  const password = assertPassword(newPassword);
  await requireSession();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new ApiError(error.message || 'Не удалось сменить пароль', {
      code: 'validation_error',
      status: 400,
    });
  }
  return data?.user ?? null;
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
  const id = await waitForSessionUserId();
  if (!id) {
    throw new ApiError('Требуется войти в аккаунт', { code: 'auth_required', status: 401 });
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new ApiError(error.message || 'Ошибка сессии', { code: 'auth_required', status: 401 });
  }
  if (!data.session?.user?.id) {
    throw new ApiError('Требуется войти в аккаунт', { code: 'auth_required', status: 401 });
  }
  return data.session;
}

export async function requireUser() {
  const id = await waitForSessionUserId();
  if (!id) {
    throw new ApiError('Требуется войти в аккаунт', { code: 'auth_required', status: 401 });
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError('Требуется войти в аккаунт', { code: 'auth_required', status: 401 });
  }
  return data.user;
}
