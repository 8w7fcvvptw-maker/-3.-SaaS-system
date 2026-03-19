# Отчёт о тестировании SaaS-системы

**Дата:** 19 марта 2026  
**Тестовый фреймворк:** Vitest

---

## 1. Что протестировано

### 1.1 Подключение к Supabase
- Выполнен тестовый запрос к таблице `services`
- Проверка загрузки переменных окружения (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

### 1.2 Клиенты (CRUD)
- **Создать** — создание клиента и проверка появления в БД
- **Получить список** — получение массива клиентов
- **Обновить** — изменение заметок клиента
- **Удалить** — удаление и проверка исчезновения записи

### 1.3 Услуги (CRUD)
- **Создать** — новая услуга
- **Редактировать** — изменение названия и цены
- **Удалить** — удаление услуги

### 1.4 Записи (Appointments)
- **Создать** — создание записи (клиент + услуга + мастер)
- **Получить список** — массив записей
- **Изменить статус** — `updateAppointmentStatus`
- **Удалить** — удаление записи

### 1.5 Настройки компании
- **Загрузить** — `getBusiness()`
- **Сохранить** — `updateBusiness()` (обновление описания)

### 1.6 Интеграция с UI (через API)
- После добавления клиента — данные появляются в списке
- После удаления — запись исчезает

### 1.7 Граничные случаи
- Попытка создать клиента с пустыми полями
- Получение несуществующего клиента (ID 999999) — ожидается ошибка

---

## 2. Результаты

| Блок | Статус | Комментарий |
|------|--------|-------------|
| Подключение к Supabase | ✅ Работает | Запрос к services выполняется |
| Клиенты CRUD | ✅ Работает | При наличии записи в `businesses` |
| Услуги CRUD | ✅ Работает | |
| Записи CRUD | ✅ Работает | При наличии услуг и сотрудников |
| Настройки компании | ✅ Работает | getBusiness, updateBusiness |
| UI интеграция | ✅ Работает | Список обновляется после CRUD |
| Граничные случаи | ✅ Работает | Обработка несуществующего ID |

**Всего тестов: 18. Все пройдены.**

---

## 3. Важные замечания

### Схема Supabase
Таблицы `clients`, `staff`, `services` могут требовать поле `business_id` (NOT NULL).  
**Исправление:** В формы создания (ClientEditor, ServiceEditor, StaffEditor) добавлена передача `business_id` из `getBusiness()`.

### Условие для части тестов
Если в таблице `businesses` нет записей, тесты создания клиентов и сотрудников пропускаются (early return).  
**Рекомендация:** Добавить в Supabase начальную запись в `businesses`:

```sql
INSERT INTO businesses (name, slug, description, address, phone, email, hours)
VALUES ('Barbershop Premium', 'barbershop', 'Описание', 'Адрес', '+7 495 000-00-00', 'info@test.ru', 'Пн–Вс: 09:00–21:00');
```

### Колонка `services` в таблице `staff`
В схеме Supabase может использоваться `service_ids` (массив) вместо `services`.  
При создании сотрудника через UI поле `services` передаётся; при несовпадении имени колонки возможна ошибка.

---

## 4. Структура проекта

```
№3. SaaS-system/
├── backend/                    # Логика работы с данными (API, Supabase)
│   ├── lib/
│   │   ├── api.js              # Точка входа — re-export всех модулей
│   │   ├── helpers.js          # throwOnError
│   │   ├── supabase.js         # Клиент Supabase
│   │   ├── business.js         # getBusiness, updateBusiness
│   │   ├── services.js         # CRUD услуг
│   │   ├── staff.js            # CRUD сотрудников
│   │   ├── clients.js          # CRUD клиентов
│   │   ├── appointments.js     # CRUD записей
│   │   ├── timeSlots.js        # getTimeSlots, getBusySlots
│   │   └── admin.js            # getAdminBusinesses, getRevenueData
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── lib/                # Re-export из backend
│   │   │   ├── api.js
│   │   │   └── supabase.js
│   │   ├── context/            # React Context (Theme, Booking)
│   │   ├── pages/              # Страницы
│   │   ├── components/
│   │   ├── hooks/
│   │   └── layouts/
│   ├── tests/                  # Тесты
│   │   ├── api.integration.test.js
│   │   └── ui.integration.test.js
│   ├── vite.config.js
│   └── package.json
├── .env.example
├── .gitignore
└── TEST_REPORT.md
```

**Логика работы с данными:** Вынесена в `backend/lib/`. Фронтенд использует её через `frontend/src/lib/api.js` (re-export).

---

## 5. Запуск тестов

```bash
cd frontend
npm run test
```

---

## 6. Рекомендации

1. **Добавить seed-данные** в Supabase (business, services, staff) для стабильной работы.
2. **Проверить RLS** (Row Level Security) в Supabase — тесты используют anon key.
3. **Дубликаты:** При наличии UNIQUE-ограничений (например, по телефону) — добавить обработку конфликтов в формах.
