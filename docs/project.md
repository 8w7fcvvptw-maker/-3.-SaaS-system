# Project

## Goal

Мультитенантное SaaS для онлайн-записи клиентов в бизнес (салон, студия и т.п.): публичная воронка бронирования, личный кабинет владельца, админ-часть по тарифам. Один бизнес привязан к пользователю Supabase Auth (`businesses.user_id`).

## Stack

- **Клиент:** Vite, React, Tailwind CSS, React Router.
- **Данные и авторизация:** Supabase (PostgreSQL, Auth, Row Level Security), официальный JS-клиент `@supabase/supabase-js`.
- **«Слой данных» в репозитории:** папка `backend/lib` — не отдельный сервер, а модули с вызовами Supabase (сессия, CRUD по сущностям). Сборка фронтенда подключает их через относительный импорт и `server.fs.allow` в `vite.config.js`.

Отдельного REST/GraphQL-сервера в коде нет: запросы идут из браузера в Supabase (PostgREST + Auth API).

## Description

Фронтенд — SPA в `frontend/`: страницы авторизации, дашборд владельца, публичное бронирование, админ-экраны. Состояние сессии — через `AuthContext` и тот же экземпляр клиента Supabase, что используют функции в `backend/lib`.

Доменные операции собраны в `backend/lib/api.js` (реэкспорт из `auth`, `business`, `services`, `staff`, `clients`, `appointments`, `timeSlots`, `admin`, `plans`). В компонентах удобный вход — `frontend/src/lib/api.js`, который реэкспортирует `backend/lib/api.js`.

Схема БД и политики — SQL в `supabase/migrations/`; тестовые данные — `supabase/seed.sql`.

## Features

- Регистрация, вход, сброс пароля (Supabase Auth).
- Профиль бизнеса, услуги, сотрудники, клиенты, записи (appointments); удаление записи только в статусах завершено / отменено / не явился.
- Слоты времени и занятость (в т.ч. RPC/справочники).
- Тарифные планы и админ-сценарии (после миграций `plans` / RLS).
- Публичная запись по бизнесу (booking flow).
