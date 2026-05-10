import type { Page } from "@playwright/test";
import { getE2eLoginEmail, getE2eLoginPassword } from "./e2e-session";

function isAppShellPath(url: URL) {
  const p = url.pathname;
  return (
    p === "/dashboard" ||
    p.startsWith("/dashboard/") ||
    p === "/onboarding" ||
    p.startsWith("/onboarding/") ||
    p === "/admin" ||
    p.startsWith("/admin/")
  );
}

/** Дождаться заголовка «Дашборд»; при ошибке getBusiness — нажать «Повторить» (медленный Supabase / флейки). */
async function waitForDashboardHeading(page: Page) {
  const heading = page.locator("h1").filter({ hasText: "Дашборд" });
  const retryBtn = page.getByRole("button", { name: "Повторить" });
  const perAttemptMs = 55_000;
  const maxRounds = 4;

  for (let round = 0; round < maxRounds; round++) {
    try {
      await heading.waitFor({ state: "visible", timeout: perAttemptMs });
      return;
    } catch {
      const canRetry = await retryBtn.isVisible().catch(() => false);
      if (canRetry) {
        await retryBtn.click();
        continue;
      }
      throw new Error(
        "После входа не появился дашборд и нет кнопки «Повторить» (проверьте Supabase и E2E_LOGIN_* в .env).",
      );
    }
  }

  await heading.waitFor({ state: "visible", timeout: perAttemptMs });
}

/** Вход под пользователем из .env; при отсутствии салона — онбординг «Ваш салон». */
export async function loginAsOwner(page: Page) {
  const email = getE2eLoginEmail();
  const password = getE2eLoginPassword();
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  try {
    await Promise.all([
      // Нельзя матчить `onboarding` подстрокой в `/login` — в слове `login` встречается `onboarding`.
      page.waitForURL((url) => isAppShellPath(url), { timeout: 90_000, waitUntil: "commit" }),
      page.getByRole("button", { name: "Войти" }).click(),
    ]);
  } catch {
    if (page.url().includes("/login")) {
      const alert = page.getByRole("alert");
      const hint = (await alert.isVisible().catch(() => false))
        ? (await alert.textContent())?.trim()
        : null;
      throw new Error(
        `После «Войти» остались на /login. Проверьте E2E_LOGIN_EMAIL и E2E_LOGIN_PASSWORD в frontend/.env. ${hint ? `Сообщение: ${hint}` : ""}`,
      );
    }
    throw new Error("Ожидался переход на /dashboard, /onboarding или /admin после входа.");
  }

  if (page.url().includes("/admin")) {
    return;
  }

  if (page.url().includes("/onboarding")) {
    await page.locator('form input[type="text"]').first().fill("E2E тестовый салон");
    await page.getByRole("button", { name: "Создать салон" }).click();
    await page.waitForURL("**/dashboard", { timeout: 90_000, waitUntil: "commit" });
  }

  await waitForDashboardHeading(page);
}
