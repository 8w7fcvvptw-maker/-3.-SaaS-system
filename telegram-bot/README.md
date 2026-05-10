# Telegram Bot для заявок SaaS

Бот собирает заявки на подключение SaaS-системы и сохраняет их в Supabase (`leads`).

## Что делает бот

- `/start` показывает главное меню.
- `Оставить заявку` запускает FSM-сценарий в памяти:
  - тип бизнеса (`business_types`)
  - тариф (`tariffs`)
  - описание задачи
  - количество сотрудников
  - контакт
  - подтверждение
- После подтверждения:
  - создается запись в `leads`
  - пользователю отправляется подтверждение
  - менеджеру отправляется уведомление, если заполнен `MANAGER_CHAT_ID`
- `Посмотреть тарифы` показывает тарифы из Supabase.
- `Задать вопрос` отвечает шаблонно (LLM пока не подключен).

## Требования

- Node.js 20+
- Telegram bot token от `@BotFather`
- Supabase project URL и service role key

## Настройка окружения

1. Скопируйте `.env.example` в `.env`.
2. Заполните значения:

```env
NODE_ENV=development
PORT=3000
WEBHOOK_URL=
TELEGRAM_WEBHOOK_SECRET=
RESET_WEBHOOK_ON_LOCAL_START=false
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MANAGER_CHAT_ID=123456789
```

`MANAGER_CHAT_ID` опционален.
`WEBHOOK_URL` обязателен только для production webhook-режима.
`TELEGRAM_WEBHOOK_SECRET` рекомендуется для production webhook-режима.
`RESET_WEBHOOK_ON_LOCAL_START=false` защищает production webhook от случайного удаления при локальном запуске.

## Создание таблиц в Supabase

1. Откройте Supabase Dashboard -> SQL Editor.
2. Выполните SQL из файла `sql/init.sql`.
3. Убедитесь, что таблицы `business_types`, `tariffs`, `leads` созданы и заполнены начальными данными.

## Локальный запуск (long polling)

```bash
cd telegram-bot
npm install
npm run start
```

Для разработки с перезапуском:

```bash
npm run dev
```

Локально бот работает через `bot.launch()` (long polling).
По умолчанию локальный запуск не удаляет существующий webhook в Telegram.
Важно: не запускайте локально тот же `TELEGRAM_BOT_TOKEN`, что используется в production, без понимания последствий — это может перехватить обновления или сбить боевой webhook при неверной конфигурации.

## Проверка работы

1. Откройте бота в Telegram и отправьте `/start`.
2. Пройдите путь `Оставить заявку`.
3. Подтвердите заявку.
4. Проверьте в Supabase Dashboard -> Table Editor -> `leads`, что появилась новая строка.
5. Если заполнен `MANAGER_CHAT_ID`, проверьте сообщение в чате менеджера.

## Обработка ошибок

- Если Supabase недоступен, бот пишет понятные ошибки в консоль на старте и при запросах:
  - проблемы подключения
  - ошибки чтения `business_types` / `tariffs`
  - ошибки вставки в `leads`

## Деплой на Render Free (webhook)

Важно: деплоить нужно именно папку `telegram-bot`, а не корень репозитория.

1. Создайте новый `Web Service` из репозитория.
2. Root directory: `telegram-bot`.
3. Build command: `npm install`.
4. Start command: `npm run start`.
5. Добавьте environment variables:
   - `NODE_ENV=production`
   - `PORT=10000` (или тот порт, который ожидает платформа)
   - `WEBHOOK_URL=https://<your-render-service>.onrender.com`
   - `TELEGRAM_WEBHOOK_SECRET=<strong-random-secret>`
   - `RESET_WEBHOOK_ON_LOCAL_START=false`
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MANAGER_CHAT_ID` (опционально)
6. Deploy.

После старта бот:
- поднимает HTTP-сервер (`GET /health`, `POST /telegram/webhook`)
- устанавливает webhook в Telegram (с `secret_token`, если задан `TELEGRAM_WEBHOOK_SECRET`)
- принимает обновления через webhook endpoint.

## Деплой на Koyeb (webhook)

Важно: деплоить нужно именно папку `telegram-bot`, а не корень репозитория.

1. Создайте новый проект из репозитория.
2. Укажите service root: `telegram-bot`.
3. Build command: `npm install`.
4. Команда запуска: `npm run start`.
5. Добавьте environment variables:
   - `NODE_ENV=production`
   - `PORT=8000` (или порт, который предоставляет Koyeb)
   - `WEBHOOK_URL=https://<your-koyeb-domain>`
   - `TELEGRAM_WEBHOOK_SECRET=<strong-random-secret>`
   - `RESET_WEBHOOK_ON_LOCAL_START=false`
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MANAGER_CHAT_ID` (опционально)
6. Выполните deploy.
