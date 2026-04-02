/** Учётные данные только из окружения (загружаются из .env в playwright.config). */
export function requireE2eCredentials(): { email: string; password: string } {
  const email = process.env.E2E_LOGIN_EMAIL?.trim();
  const password = process.env.E2E_LOGIN_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      "Задайте в frontend/.env переменные E2E_LOGIN_EMAIL и E2E_LOGIN_PASSWORD (шаблон — .env.example)."
    );
  }
  return { email, password };
}
