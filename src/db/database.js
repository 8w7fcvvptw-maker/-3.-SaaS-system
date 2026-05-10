import BetterSqlite3 from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DB_PATH } from "../config.js";

let dbInstance = null;

export function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const absolutePath = path.isAbsolute(DB_PATH) ? DB_PATH : path.resolve(DB_PATH);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

    dbInstance = new BetterSqlite3(absolutePath);
    dbInstance.pragma("journal_mode = WAL");
    return dbInstance;
  } catch (error) {
    console.error("Cannot open SQLite database:", error);
    throw error;
  }
}
