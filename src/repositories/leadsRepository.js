import { getDatabase } from "../db/database.js";

export function createLead(leadData) {
  const db = getDatabase();
  const statement = db.prepare(`
    INSERT INTO leads (
      telegram_id,
      username,
      name,
      business_type,
      tariff,
      task_description,
      employees_count,
      contact,
      status,
      ai_summary,
      recommended_tariff
    ) VALUES (
      @telegram_id,
      @username,
      @name,
      @business_type,
      @tariff,
      @task_description,
      @employees_count,
      @contact,
      @status,
      @ai_summary,
      @recommended_tariff
    )
  `);

  const result = statement.run({
    telegram_id: leadData.telegram_id,
    username: leadData.username,
    name: leadData.name,
    business_type: leadData.business_type,
    tariff: leadData.tariff,
    task_description: leadData.task_description,
    employees_count: leadData.employees_count,
    contact: leadData.contact,
    status: leadData.status ?? "new",
    ai_summary: leadData.ai_summary ?? null,
    recommended_tariff: leadData.recommended_tariff ?? null,
  });

  return db
    .prepare(
      `
      SELECT
        id,
        telegram_id,
        username,
        name,
        business_type,
        tariff,
        task_description,
        employees_count,
        contact,
        status,
        created_at,
        ai_summary,
        recommended_tariff
      FROM leads
      WHERE id = ?
      `,
    )
    .get(result.lastInsertRowid);
}

export function getAllLeads() {
  const db = getDatabase();
  return db
    .prepare(
      `
      SELECT
        id,
        telegram_id,
        username,
        name,
        business_type,
        tariff,
        task_description,
        employees_count,
        contact,
        status,
        created_at,
        ai_summary,
        recommended_tariff
      FROM leads
      ORDER BY id DESC
      `,
    )
    .all();
}
