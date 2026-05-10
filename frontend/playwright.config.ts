import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, ".env.local") });

/**
 * E2E: приложение на http://localhost:5173
 * Учётка: E2E_LOGIN_EMAIL и E2E_LOGIN_PASSWORD в .env (см. .env.example).
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  /** После входа RequireBusiness ждёт getBusiness() (до 20 с) — умолчание 5 с для expect мало. */
  expect: { timeout: 45_000 },
  /** Регистрация + Supabase могут занять больше 30 с; loginAsOwner ждёт до 45 с. */
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /** Замедление: PLAYWRIGHT_SLOW_MO=300 npx playwright test --headed */
    launchOptions:
      process.env.PLAYWRIGHT_SLOW_MO != null && process.env.PLAYWRIGHT_SLOW_MO !== ""
        ? { slowMo: Number(process.env.PLAYWRIGHT_SLOW_MO) || 0 }
        : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    cwd: path.join(__dirname, ".."),
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      SKIP_AUTH_RATE_LIMIT: "1",
      /**
       * E2E поднимает только Vite; HTTP auth-api на 3001 не гарантирован.
       * Иначе /api/auth/* может «висеть» из-за proxy target без upstream.
       */
      VITE_USE_AUTH_API: "false",
    },
  },
});
