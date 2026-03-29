/**
 * Человекочитаемые подсказки для типичных ответов Supabase Auth (вход/регистрация).
 * @param {unknown} err
 * @param {string} fallback
 */
export function formatSupabaseAuthError(err, fallback) {
  const raw = typeof err?.message === "string" ? err.message : "";
  const m = raw.toLowerCase();

  if (m.includes("email logins are disabled") || m.includes("email signup is disabled")) {
    return (
      "Вход по email в вашем проекте Supabase отключён. " +
      "Откройте Dashboard → Authentication → Providers → Email и включите «Enable Email provider» " +
      "(при необходимости включите и «Allow new users to sign up» для регистрации)."
    );
  }

  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid_credentials") ||
    m.includes("invalid email or password")
  ) {
    return (
      "Неверный email или пароль — либо такого пользователя ещё нет. " +
      "Проверьте раскладку и Caps Lock; при первом входе сначала зарегистрируйтесь. " +
      "Если включено подтверждение email в Supabase, откройте ссылку из письма, " +
      "иначе войти не получится (Authentication → Providers → Email → Confirm email / для dev можно отключить)."
    );
  }

  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return (
      "Email ещё не подтверждён. Проверьте почту (и спам) и перейдите по ссылке из письма. " +
      "Для локальной разработки в Supabase можно временно отключить «Confirm email» в настройках Email-провайдера."
    );
  }

  return raw || fallback;
}
