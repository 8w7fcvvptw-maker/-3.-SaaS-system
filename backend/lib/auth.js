import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { assertEmail, assertPassword } from './validation.js';

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
  assertEmail(email);
  assertPassword(password);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new ApiError(error.message || 'Не удалось войти', { code: 'auth_failed', status: 401 });
  return data;
}

export async function signUpWithEmail(email, password) {
  assertEmail(email);
  assertPassword(password);
  const { data, error } = await supabase.auth.signUp({ email, password });
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
