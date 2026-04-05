/**
 * Человекочитаемые подсказки для типичных ответов Supabase Auth (вход/регистрация).
 * @param {unknown} err
 * @param {string} fallback
 */
export function formatSupabaseAuthError(err, fallback) {
  if (err?.code === "rate_limit" || err?.status === 429) {
    return typeof err?.message === "string" && err.message.trim()
      ? err.message
      : "Слишком много попыток за 15 минут. Подождите и попробуйте снова.";
  }
  const raw = typeof err?.message === "string" ? err.message : "";
  const m = raw.toLowerCase();

  if (m.includes("email logins are disabled")) {
    return (
      "Вход по email в вашем проекте Supabase отключён. " +
      "Откройте Dashboard → Authentication → Providers → Email и включите «Enable Email provider»."
    );
  }

  if (
    m.includes("email signups are disabled") ||
    m.includes("email signup is disabled") ||
    m.includes("signups are disabled")
  ) {
    return (
      "Регистрация новых пользователей по email отключена в Supabase. " +
      "Чтобы снова открыть форму регистрации: Dashboard → Authentication → Providers → Email → " +
      "включите «Allow new users to sign up». Либо входите существующей учётной записью."
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

  if (m.includes("email address") && m.includes("is invalid")) {
    return (
      "Сервер отклонил этот email. Укажите другой адрес: часто блокируются домены вроде example.com / test.com, " +
      "символ «+» в локальной части (user+tag@…) или одноразовые почтовые сервисы. Используйте обычный ящик на Gmail, Mail.ru и т.п."
    );
  }

  return raw || fallback;
}
