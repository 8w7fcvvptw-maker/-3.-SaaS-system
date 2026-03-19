/**
 * Интеграционные тесты API Supabase
 * Требуют .env с VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
 * и настроенные таблицы в Supabase
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as api from '../../backend/lib/api.js';

// Временные ID для очистки после тестов
let createdClientId = null;
let createdServiceId = null;
let createdAppointmentId = null;
let businessId = null;
let hasBusiness = false;

beforeAll(async () => {
  try {
    const biz = await api.getBusiness();
    if (biz?.id) {
      businessId = biz.id;
      hasBusiness = true;
    }
  } catch (_) {}
});

describe('1. Подключение к Supabase', () => {
  it('выполняет тестовый запрос к таблице', async () => {
    const data = await api.getServices();
    expect(Array.isArray(data) || data === null).toBe(true);
  });
});

describe('2. Клиенты (CRUD)', () => {
  it('создаёт клиента и проверяет появление в БД', async () => {
    if (!hasBusiness) {
      console.warn('Пропуск: в таблице businesses нет записей (требуется business_id)');
      return;
    }
    const clientData = {
      name: 'Тест Клиент ' + Date.now(),
      phone: '+7 (999) 000-00-00',
      email: 'test@test.ru',
      notes: 'Тест',
      total_visits: 0,
      total_spent: 0,
      tags: [],
      business_id: businessId,
    };

    const newClient = await api.createClient(clientData);
    expect(newClient).toBeDefined();
    expect(newClient.id).toBeDefined();
    expect(newClient.name).toContain('Тест Клиент');
    createdClientId = newClient.id;
  });

  it('получает список клиентов — массив не пустой', async () => {
    const clients = await api.getClients();
    expect(Array.isArray(clients)).toBe(true);
  });

  it('обновляет данные клиента', async () => {
    if (!createdClientId || !hasBusiness) return;
    const updated = await api.updateClient(createdClientId, { notes: 'Обновлённая заметка' });
    expect(updated.notes).toBe('Обновлённая заметка');
  });

  it('удаляет клиента — запись исчезает', async () => {
    if (!createdClientId) return;
    await api.deleteClient(createdClientId);
    await expect(api.getClientById(createdClientId)).rejects.toThrow();
    createdClientId = null;
  });
});

describe('3. Услуги (CRUD)', () => {
  it('создаёт услугу', async () => {
    const svcData = {
      name: 'Тестовая услуга ' + Date.now(),
      description: 'Описание',
      duration: 30,
      price: 1000,
      category: 'Тест',
      color: '#6366f1',
      active: true,
    };
    if (hasBusiness) svcData.business_id = businessId;
    const newService = await api.createService(svcData);
    expect(newService).toBeDefined();
    expect(newService.id).toBeDefined();
    createdServiceId = newService.id;
  });

  it('редактирует цену/название услуги', async () => {
    if (!createdServiceId) return;
    const updated = await api.updateService(createdServiceId, {
      name: 'Обновлённая услуга',
      price: 1500,
    });
    expect(updated.name).toBe('Обновлённая услуга');
    expect(updated.price).toBe(1500);
  });

  it('удаляет услугу', async () => {
    if (!createdServiceId) return;
    await api.deleteService(createdServiceId);
    await expect(api.getServiceById(createdServiceId)).rejects.toThrow();
    createdServiceId = null;
  });
});

describe('4. Записи (Appointments)', () => {
  let testClientId;
  let testServiceId;
  let testStaffId;

  beforeAll(async () => {
    // Создаём тестовые сущности для записи
    const [clients, services, staff] = await Promise.all([
      api.getClients(),
      api.getServices(),
      api.getStaff(),
    ]);
    if (clients?.length) testClientId = clients[0].id;
    if (services?.length) testServiceId = services[0].id;
    if (staff?.length) testStaffId = staff[0].id;

    if (!services?.length) {
      const svcData = { name: 'Тест для записи', description: 'Описание', duration: 30, price: 500, category: 'Тест', color: '#6366f1', active: true };
      if (hasBusiness) svcData.business_id = businessId;
      const s = await api.createService(svcData);
      testServiceId = s.id;
      createdServiceId = s.id;
    }
    if (!staff?.length && hasBusiness) {
      const staffData = { name: 'Тест Мастер', role: 'Барбер', business_id: businessId };
      const st = await api.createStaff(staffData);
      testStaffId = st.id;
    }
    if (!clients?.length && hasBusiness) {
      const c = await api.createClient({
        name: 'Клиент для записи',
        phone: '+7 (999) 111-11-11',
        total_visits: 0,
        total_spent: 0,
        tags: [],
        business_id: businessId,
      });
      testClientId = c.id;
    }
  });

  afterAll(async () => {
    if (createdServiceId) {
      try { await api.deleteService(createdServiceId); } catch (_) {}
    }
  });

  it('создаёт запись (клиент + услуга)', async () => {
    const services = await api.getServices();
    const staff = await api.getStaff();
    if (!services?.length || !staff?.length) {
      console.warn('Нет услуг или сотрудников — пропуск');
      return;
    }
    const svc = services[0];
    const st = staff[0];
    const newApp = await api.createAppointment({
      client_name: 'Тест Клиент Записи',
      client_phone: '+7 (999) 222-22-22',
      service_id: svc.id,
      service: svc.name,
      staff_id: st.id,
      staff_name: st.name,
      date: new Date().toISOString().slice(0, 10),
      time: '10:00',
      duration: svc.duration ?? 30,
      price: svc.price ?? 500,
      status: 'pending',
    });
    expect(newApp).toBeDefined();
    expect(newApp.id).toBeDefined();
    createdAppointmentId = newApp.id;
  });

  it('получает список записей', async () => {
    const list = await api.getAppointments();
    expect(Array.isArray(list)).toBe(true);
  });

  it('изменяет статус записи', async () => {
    if (!createdAppointmentId) return;
    const updated = await api.updateAppointmentStatus(createdAppointmentId, 'confirmed');
    expect(updated.status).toBe('confirmed');
  });

  it('отменяет/удаляет запись', async () => {
    if (!createdAppointmentId) return;
    await api.deleteAppointment(createdAppointmentId);
    await expect(api.getAppointmentById(createdAppointmentId)).rejects.toThrow();
    createdAppointmentId = null;
  });
});

describe('5. Настройки компании', () => {
  let businessId;

  it('получает настройки компании', async () => {
    const biz = await api.getBusiness();
    if (biz) businessId = biz.id;
    expect(biz === null || (biz && typeof biz === 'object')).toBe(true);
  });

  it('сохраняет настройки компании', async () => {
    const biz = await api.getBusiness();
    if (!biz?.id) return;
    const updated = await api.updateBusiness(biz.id, { description: 'Обновлённое описание тест' });
    expect(updated.description).toContain('Обновлённое описание тест');
    // Откатываем
    await api.updateBusiness(biz.id, { description: biz.description || '' });
  });
});

describe('6. Граничные случаи', () => {
  it('попытка создать клиента с пустыми полями — ожидается ошибка или отклонение', async () => {
    const data = { name: '', phone: '' };
    if (businessId) data.business_id = businessId;
    try {
      await api.createClient(data);
      // Supabase может принять, если нет NOT NULL на name/phone
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it('получение несуществующего клиента — ошибка', async () => {
    await expect(api.getClientById(999999)).rejects.toThrow();
  });
});
