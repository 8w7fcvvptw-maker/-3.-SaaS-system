import { getDatabase } from "../db/database.js";

export function getActiveTariffs() {
  const db = getDatabase();
  return db
    .prepare(
      `
      SELECT id, title, description
      FROM tariffs
      WHERE is_active = 1
      ORDER BY id ASC
      `,
    )
    .all();
}

export function getTariffById(id) {
  const db = getDatabase();
  return (
    db
      .prepare(
        `
      SELECT id, title, description
      FROM tariffs
      WHERE id = ? AND is_active = 1
      `,
      )
      .get(id) ?? null
  );
}
