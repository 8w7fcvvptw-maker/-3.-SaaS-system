# Monitoring: Sentry, Logs, Uptime, Analytics

## 1) Sentry (frontend + backend)

1. Создай 2 проекта в Sentry:
   - `saas-frontend` (React)
   - `auth-api` (Node.js / Express)
2. Возьми DSN каждого проекта.
3. Заполни переменные окружения:

### Frontend (Vercel)

- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENV=production`
- `VITE_SENTRY_TRACES_SAMPLE_RATE=0.2`
- `VITE_APP_VERSION` (например commit SHA или semver)

### Backend (Railway)

- `SENTRY_DSN`
- `SENTRY_ENV=production`
- `SENTRY_TRACES_SAMPLE_RATE=0.2`
- `APP_VERSION`

После деплоя:
- frontend инициализирует Sentry в `frontend/src/lib/monitoring.js`;
- backend инициализирует Sentry в `server/observability.mjs`;
- серверные исключения летят в Sentry через `logError(...)`.

## 2) Структурированное логирование

Логи сервера выводятся JSON-строками (удобно для Railway Logs и внешних лог-агрегаторов):

- `http.request` — каждый запрос: метод, путь, статус, latency, requestId;
- `app.error` — ошибки и stack;
- `business.registration` — успешная регистрация;
- `business.order_created` — создание платежного заказа;
- `business.payment_webhook_processed` — успешный webhook от ЮKassa.

Frontend тоже пишет структурированные события в консоль:

- `frontend.business.registration_success`;
- `frontend.business.order_create_requested`;
- `frontend.business.order_create_success`;
- `frontend.error`.

## 3) UptimeRobot (аптайм)

Добавь минимум 2 HTTP(S) монитора:

1. **Frontend monitor**
   - URL: `https://3-saa-s-system.vercel.app`
   - Type: `HTTPS`
   - Interval: `5 minutes`
   - Alert contacts: email/telegram/slack

2. **Backend health monitor**
   - URL: `https://<your-railway-service>.up.railway.app/health`
   - Type: `HTTPS`
   - Expected keyword: `"ok":true` (опционально)
   - Interval: `5 minutes`

Рекомендуется:
- включить alert при 2 подряд неудачных проверках;
- добавить Status Page (public/private) для команды.

## 4) Яндекс Метрика

1. Создай счётчик в Метрике.
2. Возьми ID счётчика и добавь:
   - `VITE_YANDEX_METRIKA_ID=<counter_id>` в Vercel env.
3. Код загрузки счётчика уже подключён в `frontend/src/lib/monitoring.js`.
4. Бизнес-цели отправляются как `reachGoal`:
   - `registration_success`
   - `order_create_requested`
   - `order_create_success`

Проверь в Метрике:
- Отчёты -> События/Цели;
- DebugView (если включён) после ручной регистрации и запуска оплаты.
