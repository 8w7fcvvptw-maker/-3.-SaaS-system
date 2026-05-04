import { INITIAL_BUSINESS_TYPES, INITIAL_TARIFFS } from "../data/businessData.js";
import { getDatabase } from "./database.js";

function createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      username TEXT,
      name TEXT,
      business_type TEXT NOT NULL,
      tariff TEXT NOT NULL,
      task_description TEXT NOT NULL,
      employees_count TEXT NOT NULL,
      contact TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ai_summary TEXT,
      recommended_tariff TEXT
    );

    CREATE TABLE IF NOT EXISTS business_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tariffs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `);
}

function seedBusinessTypesIfEmpty(db) {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM business_types").get();
  const count = Number(countRow?.count ?? 0);

  if (count > 0) {
    return;
  }

  const insert = db.prepare(
    "INSERT INTO business_types (title, is_active) VALUES (@title, @is_active)",
  );

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(row);
    }
  });

  insertMany(INITIAL_BUSINESS_TYPES.map((title) => ({ title, is_active: 1 })));
}

function seedTariffsIfEmpty(db) {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM tariffs").get();
  const count = Number(countRow?.count ?? 0);

  if (count > 0) {
    return;
  }

  const insert = db.prepare(
    "INSERT INTO tariffs (id, title, description, is_active) VALUES (@id, @title, @description, @is_active)",
  );

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(row);
    }
  });

  insertMany(INITIAL_TARIFFS.map((item) => ({ ...item, is_active: 1 })));
}

export function initDb() {
  const db = getDatabase();
  createTables(db);
  seedBusinessTypesIfEmpty(db);
  seedTariffsIfEmpty(db);
}
