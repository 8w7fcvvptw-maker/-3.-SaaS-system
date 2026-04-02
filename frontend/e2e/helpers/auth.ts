import type { Page } from "@playwright/test";
import { getE2eLoginEmail, getE2eLoginPassword } from "./e2e-session";

/** Вход под пользователем из .env; при отсутствии салона — онбординг «Ваш салон». */
export async function loginAsOwner(page: Page) {
  const email = getE2eLoginEmail();
  const password = getE2eLoginPassword();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 45_000 });

  if (page.url().includes("/onboarding")) {
    await page.locator('form input[type="text"]').first().fill("E2E тестовый салон");
    await page.getByRole("button", { name: "Создать салон" }).click();
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
  }

  await page.getByRole("heading", { name: "Дашборд" }).waitFor({ state: "visible", timeout: 45_000 });
}
