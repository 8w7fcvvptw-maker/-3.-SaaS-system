# SaaS Booking System

Многопользовательская SaaS-платформа для управления записями (барбершопы, салоны красоты и т.д.).  
Frontend на React + Vite + TailwindCSS, бэкенд — Supabase.

---

## Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить переменные окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Откройте `.env` и заполните:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<вставьте anon public key из Dashboard, без кавычек>
```

Эти значения находятся в панели Supabase:  
**Project Settings → API → Project URL** и **anon public key**.

### 3. Создать таблицы в Supabase

Выполните в Supabase SQL Editor:

```sql
-- Бизнесы
create table businesses (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique,
  name       text not null,
  logo       text,
  description text,
  address    text,
  phone      text,
  email      text,
  hours      text,
  rating     numeric default 0,
  reviews    int default 0,
  timezone   text default 'Europe/Moscow'
);

-- Услуги
create table services (
  id          serial primary key,
  name        text not null,
  duration    int not null,
  price       numeric not null,
  category    text,
  active      boolean default true,
  color       text default '#6366f1',
  description text
);

-- Сотрудники
create table staff (
  id            serial primary key,
  name          text not null,
  role          text,
  avatar        text,
  rating        numeric default 0,
  specialization text,
  services      int[],        -- массив ID услуг
  next_available text,
  phone         text,
  working_hours text
);

-- Записи
create table appointments (
  id           serial primary key,
  client_name  text,
  client_phone text,
  service      text,
  service_id   int,
  staff_id     int,
  staff_name   text,
  date         date,
  time         text,
  duration     int,
  price        numeric,
  status       text default 'pending',
  notes        text
);

-- Клиенты
create table clients (
  id           serial primary key,
  name         text not null,
  phone        text,
  email        text,
  total_visits int default 0,
  last_visit   date,
  total_spent  numeric default 0,
  tags         text[],
  notes        text
);

-- Временные слоты (опционально — если не заполнено, используются дефолтные)
create table time_slots (
  slot text primary key
);

-- Admin: бизнесы на платформе
create table admin_businesses (
  id      serial primary key,
  name    text not null,
  plan    text default 'Free',
  users   int default 1,
  created date,
  status  text default 'active',
  revenue numeric default 0
);

-- Данные для аналитики (выручка по месяцам)
create table revenue_data (
  id         serial primary key,
  sort_order int default 0,
  month      text not null,
  revenue    numeric default 0,
  bookings   int default 0
);
```

### 3.1. Связи между таблицами и seed

Чтобы внешние ключи и вложенные запросы в API работали предсказуемо:

1. В **SQL Editor** по порядку выполните SQL из **`supabase/migrations/`**: `001_relations.sql`, при необходимости `002_appointments_fk.sql`, затем `003_plans.sql`, затем `004_rls_auth.sql` (последний включает RLS и требует таблицу `plans`).
2. Тестовые данные (бизнес, услуги, мастера, клиенты, записи): **`supabase/seed.sql`**. Порядок и требования — в **`КАК_СОЗДАТЬ_БИЗНЕС.md`** (раздел про seed).

### 4. Настроить Row Level Security (опционально для продакшн)

```sql
-- Для разработки можно временно разрешить всё:
alter table businesses      enable row level security;
alter table services        enable row level security;
alter table staff           enable row level security;
alter table appointments    enable row level security;
alter table clients         enable row level security;
alter table admin_businesses enable row level security;
alter table revenue_data    enable row level security;

-- Политика: анонимный доступ на чтение
create policy "Public read" on businesses      for select using (true);
create policy "Public read" on services        for select using (true);
create policy "Public read" on staff           for select using (true);
create policy "Public read" on appointments    for select using (true);
create policy "Public read" on clients         for select using (true);
create policy "Public read" on admin_businesses for select using (true);
create policy "Public read" on revenue_data    for select using (true);
```

### 5. Запустить проект

```bash
npm run dev
```

Откройте [http://localhost:5173](http://localhost:5173).

**Запуск на смартфоне:** см. [ЗАПУСК_НА_СМАРТФОНЕ.md](ЗАПУСК_НА_СМАРТФОНЕ.md).

---

## Структура проекта

```
src/
├── lib/
│   ├── supabase.js       # Клиент Supabase (читает VITE_SUPABASE_*)
│   └── api.js            # Все функции запросов к Supabase
├── hooks/
│   └── useAsync.js       # Хук для загрузки данных (loading / error / data)
├── pages/
│   ├── dashboard/        # Кабинет бизнеса
│   ├── booking/          # Публичная зона записи
│   └── admin/            # SaaS Admin панель
└── components/
    └── ui.jsx            # UI-примитивы (включает LoadingState, ErrorState)
```

## Переменные окружения

| Переменная              | Описание                                    |
|-------------------------|---------------------------------------------|
| `VITE_SUPABASE_URL`     | URL вашего Supabase проекта                 |
| `VITE_SUPABASE_ANON_KEY`| Анонимный публичный ключ из Supabase        |

## Стек

- **React 19** + **React Router 7**
- **Vite 8** + **TailwindCSS 4**
- **Supabase JS SDK** (`@supabase/supabase-js`)

## Loading & Error states

Каждая страница использует хук `useAsync`:

```js
const { data, loading, error } = useAsync(() => getAppointments());

if (loading) return <LoadingState />;
if (error)   return <ErrorState message={error.message} />;
```

- `LoadingState` — анимированный спиннер с текстом "Загрузка..."
- `ErrorState` — красный блок с сообщением об ошибке
