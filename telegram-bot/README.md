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
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MANAGER_CHAT_ID=123456789
```

`MANAGER_CHAT_ID` опционален.

## Создание таблиц в Supabase

1. Откройте Supabase Dashboard -> SQL Editor.
2. Выполните SQL из файла `sql/init.sql`.
3. Убедитесь, что таблицы `business_types`, `tariffs`, `leads` созданы и заполнены начальными данными.

## Локальный запуск

```bash
cd telegram-bot
npm install
npm run start
```

Для разработки с перезапуском:

```bash
npm run dev
```

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

## Деплой на Render

Важно: деплоить нужно именно папку `telegram-bot`, а не корень репозитория.

1. Создайте новый `Web Service` из репозитория.
2. Root directory: `telegram-bot`.
3. Build command: `npm install`.
4. Start command: `npm run start`.
5. Добавьте environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MANAGER_CHAT_ID` (опционально)
6. Deploy.

## Деплой на Railway

Важно: деплоить нужно именно папку `telegram-bot`, а не корень репозитория.

1. Создайте новый проект из репозитория.
2. Укажите service root: `telegram-bot`.
3. Команда запуска: `npm run start`.
4. Добавьте environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MANAGER_CHAT_ID` (опционально)
5. Выполните deploy.
