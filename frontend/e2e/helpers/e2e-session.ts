/**
 * После первого успешного входа сохраняем email/пароль в файл (для стабильности воркеров).
 * Источник правды: E2E_LOGIN_EMAIL и E2E_LOGIN_PASSWORD в .env (без дефолтов в коде).
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CREDENTIALS_PATH = path.join(process.cwd(), "e2e", ".e2e-credentials.json");

let lastRegisteredEmail: string | null = null;

function readCredentialsFile(): { email?: string; password?: string } | null {
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    return JSON.parse(raw) as { email?: string; password?: string };
  } catch {
    return null;
  }
}

export function setE2eRegisteredEmail(email: string, password: string) {
  const e = email.trim();
  lastRegisteredEmail = e;
  fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true });
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify({ email: e, password }), "utf8");
}

function missingEnvMessage() {
  return "Укажите E2E_LOGIN_EMAIL и E2E_LOGIN_PASSWORD в frontend/.env (см. .env.example).";
}

export function getE2eLoginEmail(): string {
  const fromEnv = process.env.E2E_LOGIN_EMAIL?.trim();
  if (fromEnv) return fromEnv;
  if (lastRegisteredEmail) return lastRegisteredEmail;
  const fromFile = readCredentialsFile()?.email?.trim();
  if (fromFile) return fromFile;
  throw new Error(missingEnvMessage());
}

export function getE2eLoginPassword(): string {
  const fromEnv = process.env.E2E_LOGIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  const fromFile = readCredentialsFile()?.password;
  if (fromFile) return fromFile;
  throw new Error(missingEnvMessage());
}
