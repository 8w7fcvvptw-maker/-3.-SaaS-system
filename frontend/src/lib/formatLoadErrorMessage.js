/**
 * Превращает низкоуровневые сетевые ошибки fetch в текст для пользователя.
 */
export function formatLoadErrorMessage(errOrMessage) {
  const m =
    errOrMessage == null
      ? ""
      : typeof errOrMessage === "string"
        ? errOrMessage
        : errOrMessage?.message ?? String(errOrMessage);

  if (
    /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_network/i.test(
      m
    )
  ) {
    return (
      "Не удалось связаться с Supabase (запрос не дошёл до сервера).\n\n" +
      "• Проверьте frontend/.env: VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY из Project Settings → API.\n" +
      "• После изменения .env обязательно перезапустите dev-сервер (npm run dev).\n" +
      "• URL должен быть https://…supabase.co, проект в панели Supabase не на паузе.\n" +
      "• Проверьте интернет, VPN и блокировщики расширений в браузере."
    );
  }
  return m;
}
