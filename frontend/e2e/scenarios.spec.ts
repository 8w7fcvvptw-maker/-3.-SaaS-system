import { test, expect } from "@playwright/test";
import { loginAsOwner } from "./helpers/auth";
import { setE2eRegisteredEmail, getE2eLoginEmail } from "./helpers/e2e-session";
import { requireE2eCredentials } from "./helpers/require-e2e-env";

function uniquePhone() {
  const t = Date.now().toString().slice(-9);
  return `+7 (999) ${t.slice(0, 3)}-${t.slice(3, 5)}-${t.slice(5, 7)}`;
}

test.describe.serial("SaaS E2E — сценарии по порядку", () => {
  /** Вход + Supabase + несколько шагов UI часто > 90 с на медленной сети. */
  test.describe.configure({ timeout: 180_000 });

  test.describe("1. Регистрация пользователя", () => {
    /**
     * В Supabase часто отключены новые signups — тогда UI-регистрация невозможна.
     * Сценарий: вход с учёткой из .env и при необходимости первичный онбординг салона («Ваш салон»).
     */
    test("вход в приложение и при необходимости онбординг, затем дашборд", async ({ page }) => {
      const { email, password } = requireE2eCredentials();

      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Пароль").fill(password);
      await page.getByRole("button", { name: "Войти" }).click();

      await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 45_000 });

      if (page.url().includes("/onboarding")) {
        await expect(page.getByRole("heading", { name: "Ваш салон" })).toBeVisible({ timeout: 45_000 });
        await page.locator('form input[type="text"]').first().fill(`Салон E2E ${Date.now()}`);
        await page.getByRole("button", { name: "Создать салон" }).click();
        await page.waitForURL("**/dashboard", { timeout: 45_000 });
      }

      await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible({ timeout: 45_000 });
      setE2eRegisteredEmail(email, password);
    });
  });

  test.describe("2. Авторизация (вход)", () => {
    test("успешный вход с верными данными", async ({ page }) => {
      await loginAsOwner(page);
      await expect(page).toHaveURL(/\/dashboard$/);
    });

    test("неверный пароль — ошибка, вход не выполнен", async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(getE2eLoginEmail());
      await page.getByLabel("Пароль").fill("совсем_не_тот_пароль_12345");
      await page.getByRole("button", { name: "Войти" }).click();

      await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("3. Ограничение доступа без авторизации", () => {
    test("редирект на страницу входа с /dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
    });

    test("редирект со страницы клиентов", async ({ page }) => {
      await page.goto("/clients");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("4. Создание записи", () => {
    test("создание клиента и появление в списке", async ({ page }) => {
      const name = `E2E Клиент ${Date.now()}`;
      const phone = uniquePhone();

      await loginAsOwner(page);
      await page.goto("/clients/new");

      await page.getByLabel(/^Имя/).fill(name);
      await page.getByLabel(/^Телефон/).fill(phone);
      await page.getByRole("button", { name: "Сохранить" }).click();

      await page.waitForURL((url) => /\/clients\/?$/.test(url.pathname) && !url.pathname.includes("/new"), {
        timeout: 90_000,
        waitUntil: "commit",
      });
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    });
  });

  test.describe("5. Редактирование данных", () => {
    test("изменение заметок клиента отображается после сохранения", async ({ page }) => {
      const name = `E2E Редакт ${Date.now()}`;
      const note = `Заметка ${Date.now()}`;

      await loginAsOwner(page);
      await page.goto("/clients/new");
      await page.getByLabel(/^Имя/).fill(name);
      await page.getByLabel(/^Телефон/).fill(uniquePhone());
      await page.getByRole("button", { name: "Сохранить" }).click();
      await page.waitForURL("**/clients", { timeout: 60_000 });

      await page.getByText(name, { exact: true }).click();
      await page.waitForURL(/\/clients\/[^/]+$/);

      const notesArea = page.getByRole("heading", { name: "Заметки" }).locator("..").locator("textarea").first();
      await notesArea.fill(note);
      await notesArea.blur();

      await expect(page.getByText("Сохранение...")).toBeHidden({ timeout: 15_000 });
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Заметки" }).locator("..").locator("textarea").first()
      ).toHaveValue(note);
    });
  });

  test.describe("6. Удаление записи", () => {
    test("удаление услуги — исчезает из списка", async ({ page }) => {
      const serviceName = `E2E Услуга ${Date.now()}`;

      await loginAsOwner(page);
      await page.goto("/services/new");

      await page.getByLabel(/^Название/).fill(serviceName);
      await page.getByLabel(/^Описание/).fill("Описание для E2E");
      await page.getByLabel(/Длительность/).fill("30");
      await page.getByLabel(/Цена/).fill("500");
      await page.getByRole("button", { name: "Сохранить" }).click();
      await page.waitForURL("**/services", { timeout: 60_000 });

      await expect(page.getByText(serviceName, { exact: true })).toBeVisible();

      const serviceCard = page
        .getByText(serviceName, { exact: true })
        .locator("xpath=ancestor::div[contains(@class,'hover:shadow-md')]")
        .first();
      page.once("dialog", (d) => d.accept());
      await serviceCard.getByRole("button", { name: "🗑" }).first().click();

      await expect(page.getByText(serviceName, { exact: true })).toBeHidden({ timeout: 20_000 });
    });
  });

  test.describe("7. Валидация формы", () => {
    test("вход без обязательных полей — показываются ошибки", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Войти" }).click();

      await expect(page.locator("#login-email-err")).toContainText("Укажите email");
      await expect(page.locator("#login-password-err")).toContainText("Укажите пароль");
    });
  });
});
