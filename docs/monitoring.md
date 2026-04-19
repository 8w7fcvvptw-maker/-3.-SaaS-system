# Monitoring: Yandex Cloud Monitoring, Logs, Uptime, Analytics

## 1) Yandex Cloud Monitoring (метрики)

Бэкенд (`server/auth-api.mjs`) при старте читает учётные данные и при ошибках и бизнес-событиях пишет **кастомные метрики** в каталог через API `service=custom`.

### Что нужно в консоли Yandex Cloud

1. Каталог (folder): скопируй **ID каталога**.
2. Сервисный аккаунт с ролью **`monitoring.writer`** (или выше).
3. Для этого аккаунта создай **статический ключ доступа** (Access key ID + Secret / PEM приватный ключ).

Подробнее: [Добавление метрик](https://cloud.yandex.ru/docs/monitoring/operations/metric/add).

### Переменные окружения (Railway)

| Переменная | Назначение |
|------------|------------|
| `YC_FOLDER_ID` | ID каталога |
| `YC_SERVICE_ACCOUNT_ID` | ID сервисного аккаунта |
| `YC_ACCESS_KEY_ID` | Идентификатор статического ключа |
| `YC_PRIVATE_KEY` | Приватный ключ PEM (в `.env` одной строкой с `\n` между строками PEM) |
| `YC_DEPLOY_ENV` | Произвольная метка окружения в метриках (например `production`) |

Имена метрик (можно строить дашборды и алерты):

- `saas.auth_api.error` — исключение на сервере (labels: `route`, при необходимости `area`);
- `saas.frontend.error` — ошибка с фронта, принятая через ingest (labels: `route`, `area`, `action`);
- `saas.business.<событие>` — импульсы бизнес-событий (`registration`, `order_created`, `payment_webhook_processed`; labels: `plan`, `payment_id` где уместно).

Секреты сервисного аккаунта **не попадают в браузер**.

### Ошибки React → Monitoring

Фронт по флагу шлёт `POST /api/monitoring/ingest` на тот же origin (на Vercel это прокси на Railway).

**Vercel:** задайте

- `VITE_YC_MONITORING_INGEST=true`
- `VITE_MONITORING_INGEST_SECRET` — опционально; тогда на Railway такой же **`MONITORING_INGEST_SECRET`** и проверка заголовка `x-monitoring-secret`.

## 2) Структурированное логирование

Логи сервера — JSON-строки в stdout (удобно для Railway Logs):

- `http.request` — метод, путь, статус, latency, requestId;
- `app.error` — ошибки и stack;
- `business.*` — то же, что уходит в метрики бизнес-событий.

Фронт дополнительно пишет в консоль браузера события `frontend.business.*` и `frontend.error`.

## 3) UptimeRobot (аптайм)

Минимум два монитора HTTPS:

1. Фронт: `https://<ваш-проект>.vercel.app`
2. Бэкенд: `https://<railway>.up.railway.app/health`

Интервал 5 минут, алерт после 2 неудач подряд — по желанию.

## 4) Яндекс Метрика

1. Создай счётчик в Метрике.
2. В Vercel: `VITE_YANDEX_METRIKA_ID=<число>`.
3. Цели `reachGoal`: `registration_success`, `order_create_requested`, `order_create_success` (см. `frontend/src/lib/monitoring.js` и страницы).
