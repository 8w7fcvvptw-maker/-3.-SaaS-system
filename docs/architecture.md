# Architecture

## Frontend (`frontend/`)

Одностраничное приложение на Vite + React: маршруты и экраны в `src/pages/`, общие лейауты в `src/layouts/`, контексты (`AuthContext`, `BookingContext` и др.), UI в `src/components/`.

Импорт доменной логики: **`frontend/src/lib/api.js`** и **`frontend/src/lib/supabase.js`** — тонкие реэкспорты на **`backend/lib`**, чтобы не дублировать код и не плодить второй HTTP-слой.

## Backend в репозитории (`backend/lib/`)

Это **не** отдельный запущенный backend-процесс. Набор ES-модулей, которые:

- создают singleton Supabase-клиента (`supabase.js`, переменные `VITE_SUPABASE_*`);
- инкапсулируют запросы к таблицам и Auth (`auth.js`, `business.js`, `services.js`, `staff.js`, `clients.js`, `appointments.js`, `timeSlots.js`, `plans.js`, `admin.js`, `access.js` и др.);
- отдают единую точку входа через `api.js`.

Таким образом, «сервисный слой» живёт в `backend/lib`, а исполняется в том же процессе, что и SPA (браузер или тестовый раннер).

## Database (Supabase / PostgreSQL)

Основные таблицы предметной области (имена как в коде):

- `businesses` — тенант, связь с `auth.users`;
- `services`, `staff`, `clients`;
- `appointments` — записи;
- `time_slots` — справочник/слоты;
- `plans` — тарифы (после соответствующей миграции).

Определения, внешние ключи и RLS — в `supabase/migrations/`; начальные данные — `supabase/seed.sql`.

## Edge Functions (`supabase/functions/`)

- **`notify-appointment-telegram`** — после создания записи SPA вызывает `supabase.functions.invoke`; функция проверяет JWT, по `appointment_id` читает строку через service role и убеждается, что `businesses.user_id` совпадает с пользователем, затем шлёт сообщение в Telegram Bot API. Секреты (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; при локальном `serve` ещё `SUPABASE_SERVICE_ROLE_KEY`) не попадают во фронт; см. `frontend/.env.example` и `supabase/.env.functions.example`. **В продакшене** для CORS задай секрет **`ALLOWED_ORIGINS`** (URL фронта, без `/` в конце) — пошагово: `docs/deploy-edge-functions.md`. Локальный прогон: из корня `npm run supabase:start` (Docker), затем `npm run functions:serve`.

## Flow

1. Пользователь открывает SPA; Vite отдаёт статику и бандл.
2. React инициализирует клиент Supabase (из `backend/lib/supabase.js` через реэкспорт во `frontend`).
3. Экраны вызывают функции из `api.js` → модули `backend/lib/*` формируют запросы `.from('…')`, `.auth.*`, при необходимости `.rpc()`.
4. Supabase (PostgREST + GoTrue) обрабатывает запросы; RLS ограничивает строки по `business_id` / `user_id` и политикам из миграций.

**Итог:** данные идут по цепочке *UI → `backend/lib` → Supabase SDK → облако Supabase*; уведомления Telegram — *UI → Edge Function → Telegram API*. Отдельного своего Node API к БД в проекте нет.
