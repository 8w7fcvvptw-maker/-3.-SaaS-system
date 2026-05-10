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
- `Задать вопрос` включает режим вопроса: следующее текстовое сообщение отправляется в OpenAI (`gpt-4o-mini`). Без `OPENAI_API_KEY` бот отвечает шаблоном и не падает.

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
OPENAI_API_KEY=
```

`MANAGER_CHAT_ID` опционален.
`OPENAI_API_KEY` опционален: если не задан, в сценарии «Задать вопрос» пользователь увидит шаблонное сообщение вместо ответа AI.
`WEBHOOK_URL` обязателен только для production webhook-режима.
`TELEGRAM_WEBHOOK_SECRET` рекомендуется для production webhook-режима.
`RESET_WEBHOOK_ON_LOCAL_START=false` защищает production webhook от случайного удаления при локальном запуске.
`PORT` обязателен: бот всегда слушает порт из `process.env.PORT`.

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
6. Проверьте «Задать вопрос»: нажмите кнопку, затем отправьте тестовый вопрос. С `OPENAI_API_KEY` должен прийти краткий ответ; без ключа — шаблон «AI временно недоступен».

## Обработка ошибок

- Если Supabase недоступен, бот пишет понятные ошибки в консоль на старте и при запросах:
  - проблемы подключения
  - ошибки чтения `business_types` / `tariffs`
  - ошибки вставки в `leads`

## Деплой на Koyeb (webhook)

Важно: деплоить нужно именно папку `telegram-bot`, а не корень репозитория.

1. Создайте новый сервис из Git-репозитория.
2. В настройках укажите root/service directory: `telegram-bot`.
3. Build command: `npm install`.
4. Start command: `npm run start`.
5. Добавьте environment variables:
   - `NODE_ENV=production`
   - `PORT` (значение, которое использует Koyeb для web service)
   - `WEBHOOK_URL=https://<ваш-домен>.koyeb.app`
   - `TELEGRAM_WEBHOOK_SECRET=<strong-random-secret>`
   - `RESET_WEBHOOK_ON_LOCAL_START=false`
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MANAGER_CHAT_ID` (опционально)
6. Запустите deploy.

## Деплой на Railway (webhook)

Важно: деплоить нужно именно папку `telegram-bot`, а не корень репозитория.

1. Создайте новый проект из GitHub-репозитория.
2. Укажите root directory: `telegram-bot`.
3. Build command: `npm install`.
4. Start command: `npm run start`.
5. Добавьте environment variables:
   - `NODE_ENV=production`
   - `PORT` (Railway передает его в `process.env.PORT`)
   - `WEBHOOK_URL=https://<ваш-домен>.up.railway.app`
   - `TELEGRAM_WEBHOOK_SECRET=<strong-random-secret>`
   - `RESET_WEBHOOK_ON_LOCAL_START=false`
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MANAGER_CHAT_ID` (опционально)
   - `OPENAI_API_KEY` (опционально; ответы AI в сценарии «Задать вопрос»)
6. Выполните deploy.

### Как добавить OPENAI_API_KEY на Railway

1. Откройте проект на [Railway](https://railway.app/) → сервис с ботом (root directory `telegram-bot`).
2. Перейдите в **Variables** (переменные окружения).
3. Добавьте новую переменную: имя `OPENAI_API_KEY`, значение — секретный ключ из [OpenAI API keys](https://platform.openai.com/api-keys) (начинается с `sk-...`).
4. Сохраните изменения и дождитесь автоматического redeploy (или запустите deploy вручную).

Без этой переменной бот продолжит работать: в «Задать вопрос» будет шаблонный текст вместо AI. Webhook и остальные функции не затрагиваются.

В production режиме (`NODE_ENV=production` + задан `WEBHOOK_URL`) бот:
- поднимает HTTP-сервер (`GET /health`, `POST /telegram/webhook`)
- устанавливает webhook в Telegram (с `secret_token`, если задан `TELEGRAM_WEBHOOK_SECRET`)
- принимает обновления только через webhook endpoint.

## Как проверить после деплоя

1. Откройте `https://<ваш-домен>/health` и убедитесь, что ответ: `{"ok":true}`.
2. Напишите `/start` вашему Telegram-боту и проверьте, что он отвечает меню.
3. Отправьте тестовую заявку и проверьте таблицу `leads` в Supabase.
4. Нажмите «Задать вопрос», отправьте короткий вопрос: с `OPENAI_API_KEY` должен прийти ответ AI; при ошибке API или без ключа — понятный запасной текст.
