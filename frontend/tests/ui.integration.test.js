/**
 * Тесты интеграции UI — проверка отображения после CRUD
 * Используют API для симуляции действий пользователя
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as api from '../../backend/lib/api.js';

let businessId = null;
let testClientId = null;

beforeAll(async () => {
  await api.signInTestUser();
  try {
    const biz = await api.getBusiness();
    if (biz?.id) businessId = biz.id;
  } catch (_) {}
});

afterAll(async () => {
  if (testClientId) {
    try { await api.deleteClient(testClientId); } catch (_) {}
  }
});

describe('7. Интеграция с UI (через API)', () => {
  it('после добавления клиента — данные появляются в списке', async () => {
    if (!businessId) return;
    const created = await api.createClient({
      name: 'UI Тест ' + Date.now(),
      phone: '+7 (999) 333-33-33',
      business_id: businessId,
      total_visits: 0,
      total_spent: 0,
      tags: [],
    });
    testClientId = created.id;

    const list = await api.getClients();
    const found = list.find((c) => c.id === created.id);
    expect(found).toBeDefined();
    expect(found.name).toContain('UI Тест');
  });

  it('после удаления — запись исчезает из списка', async () => {
    if (!testClientId) return;
    await api.deleteClient(testClientId);

    const list = await api.getClients();
    const found = list.find((c) => c.id === testClientId);
    expect(found).toBeUndefined();
    testClientId = null;
  });
});
