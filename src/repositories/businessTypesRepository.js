import { getDatabase } from "../db/database.js";

export function getActiveBusinessTypes() {
  const db = getDatabase();
  return db
    .prepare(
      `
      SELECT id, title
      FROM business_types
      WHERE is_active = 1
      ORDER BY id ASC
      `,
    )
    .all();
}

export function getBusinessTypeById(id) {
  const db = getDatabase();
  return (
    db
      .prepare(
        `
      SELECT id, title
      FROM business_types
      WHERE id = ? AND is_active = 1
      `,
      )
      .get(id) ?? null
  );
}
