import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");
dotenv.config({ path: path.join(frontendRoot, ".env") });
dotenv.config({ path: path.join(frontendRoot, ".env.local") });

/** Перед прогоном убираем файл сессии E2E от прошлого запуска. */
export default async function globalSetup() {
  const p = path.join(frontendRoot, "e2e", ".e2e-credentials.json");
  try {
    fs.unlinkSync(p);
  } catch {
    /* файла нет — нормально */
  }
}
