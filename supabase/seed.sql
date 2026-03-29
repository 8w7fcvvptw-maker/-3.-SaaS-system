-- ============================================================
-- Тестовые данные (seed) для SaaS Booking
-- ============================================================
-- Когда запускать: после создания таблиц и после
--   supabase/migrations/001_relations.sql (внешние ключи).
--
-- Требования:
--   • В таблице businesses есть колонка slug (см. supabase/migrations/004_rls_auth.sql).
--   • В Supabase уже есть хотя бы один пользователь:
--     Authentication → Users (иначе нельзя заполнить businesses.user_id).
--
-- Идемпотентность: повторный запуск не дублирует строки с префиксом SEED.
--
-- Важно: приложение берёт первый ряд из businesses (limit 1). Если нужен
-- именно демо-бизнес в кабинете — временно сделайте его первым в таблице
-- или удалите лишние строки для теста.
-- ============================================================

DO $$
DECLARE
  uid          uuid;
  bid          bigint;
  sid_cut      bigint;
  sid_beard    bigint;
  stid1        bigint;
  stid2        bigint;
  cid1         bigint;
  cid2         bigint;
BEGIN
  SELECT u.id INTO uid
  FROM auth.users AS u
  ORDER BY u.created_at
  LIMIT 1;

  IF uid IS NULL THEN
    RAISE EXCEPTION
      'Seed: нет пользователей в Authentication. Создайте пользователя (Add user), затем снова выполните этот скрипт.';
  END IF;

  SELECT b.id INTO bid
  FROM public.businesses AS b
  WHERE b.name = 'SEED Демо-салон'
  LIMIT 1;

  IF bid IS NULL THEN
    INSERT INTO public.businesses (
      user_id,
      slug,
      name,
      description,
      address,
      phone,
      email,
      hours,
      timezone,
      plan,
      status
    )
    VALUES (
      uid,
      'barbershop',
      'SEED Демо-салон',
      'Тестовые данные: услуги, мастера, клиенты и записи со связями.',
      'г. Москва, ул. Сидовая, д. 1',
      '+7 900 555-00-01',
      'seed-demo@example.com',
      'Пн–Вс: 09:00–21:00',
      'Europe/Moscow',
      'Free',
      'active'
    )
    RETURNING id INTO bid;
  END IF;

  SELECT s.id INTO sid_cut
  FROM public.services AS s
  WHERE s.business_id = bid AND s.name = 'SEED Стрижка'
  LIMIT 1;

  IF sid_cut IS NULL THEN
    INSERT INTO public.services (
      business_id, name, description, duration, price, category, color, active
    )
    VALUES (
      bid, 'SEED Стрижка', 'Классическая стрижка', 30, 1500, 'Стрижки', '#6366f1', true
    )
    RETURNING id INTO sid_cut;
  END IF;

  SELECT s.id INTO sid_beard
  FROM public.services AS s
  WHERE s.business_id = bid AND s.name = 'SEED Борода'
  LIMIT 1;

  IF sid_beard IS NULL THEN
    INSERT INTO public.services (
      business_id, name, description, duration, price, category, color, active
    )
    VALUES (
      bid, 'SEED Борода', 'Оформление бороды', 30, 800, 'Борода', '#8b5cf6', true
    )
    RETURNING id INTO sid_beard;
  END IF;

  SELECT s.id INTO stid1
  FROM public.staff AS s
  WHERE s.business_id = bid AND s.name = 'SEED Алексей Мастер'
  LIMIT 1;

  IF stid1 IS NULL THEN
    INSERT INTO public.staff (
      business_id, name, role, phone, working_hours, rating, specialization
    )
    VALUES (
      bid,
      'SEED Алексей Мастер',
      'Старший барбер',
      '+7 900 555-11-01',
      'Вт–Вс: 10:00–20:00',
      4.9,
      'Стрижки, фейды'
    )
    RETURNING id INTO stid1;
  END IF;

  SELECT s.id INTO stid2
  FROM public.staff AS s
  WHERE s.business_id = bid AND s.name = 'SEED Мария Стилист'
  LIMIT 1;

  IF stid2 IS NULL THEN
    INSERT INTO public.staff (
      business_id, name, role, phone, working_hours, rating, specialization
    )
    VALUES (
      bid,
      'SEED Мария Стилист',
      'Мастер',
      '+7 900 555-11-02',
      'Пн–Пт: 09:00–19:00',
      4.7,
      'Универсал'
    )
    RETURNING id INTO stid2;
  END IF;

  INSERT INTO public.staff_services (staff_id, service_id)
  VALUES
    (stid1, sid_cut),
    (stid1, sid_beard),
    (stid2, sid_cut)
  ON CONFLICT (staff_id, service_id) DO NOTHING;

  SELECT c.id INTO cid1
  FROM public.clients AS c
  WHERE c.business_id = bid AND c.phone = '+7 (999) SEED-1001'
  LIMIT 1;

  IF cid1 IS NULL THEN
    INSERT INTO public.clients (
      business_id,
      name,
      phone,
      email,
      total_visits,
      last_visit,
      total_spent,
      tags,
      notes
    )
    VALUES (
      bid,
      'SEED Иван Петров',
      '+7 (999) SEED-1001',
      'ivan.seed@example.com',
      5,
      '2026-03-20',
      7500,
      ARRAY['постоянный']::text[],
      NULL
    )
    RETURNING id INTO cid1;
  END IF;

  SELECT c.id INTO cid2
  FROM public.clients AS c
  WHERE c.business_id = bid AND c.phone = '+7 (999) SEED-1002'
  LIMIT 1;

  IF cid2 IS NULL THEN
    INSERT INTO public.clients (
      business_id,
      name,
      phone,
      email,
      total_visits,
      last_visit,
      total_spent,
      tags,
      notes
    )
    VALUES (
      bid,
      'SEED Анна Козлова',
      '+7 (999) SEED-1002',
      'anna.seed@example.com',
      2,
      '2026-03-25',
      2300,
      ARRAY[]::text[],
      NULL
    )
    RETURNING id INTO cid2;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.appointments AS a
    WHERE a.business_id = bid AND a.notes = 'SEED_APPT_1'
  ) THEN
    INSERT INTO public.appointments (
      business_id,
      service_id,
      staff_id,
      client_id,
      client_name,
      client_phone,
      client_email,
      date,
      time,
      duration,
      price,
      status,
      notes
    )
    VALUES (
      bid,
      sid_cut,
      stid1,
      cid1,
      'SEED Иван Петров',
      '+7 (999) SEED-1001',
      'ivan.seed@example.com',
      '2026-03-30',
      '10:00',
      30,
      1500,
      'confirmed',
      'SEED_APPT_1'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.appointments AS a
    WHERE a.business_id = bid AND a.notes = 'SEED_APPT_2'
  ) THEN
    INSERT INTO public.appointments (
      business_id,
      service_id,
      staff_id,
      client_id,
      client_name,
      client_phone,
      client_email,
      date,
      time,
      duration,
      price,
      status,
      notes
    )
    VALUES (
      bid,
      sid_beard,
      stid2,
      cid2,
      'SEED Анна Козлова',
      '+7 (999) SEED-1002',
      'anna.seed@example.com',
      '2026-03-30',
      '14:30',
      30,
      800,
      'pending',
      'SEED_APPT_2'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.appointments AS a
    WHERE a.business_id = bid AND a.notes = 'SEED_APPT_3'
  ) THEN
    INSERT INTO public.appointments (
      business_id,
      service_id,
      staff_id,
      client_id,
      client_name,
      client_phone,
      date,
      time,
      duration,
      price,
      status,
      notes
    )
    VALUES (
      bid,
      sid_cut,
      stid1,
      NULL,
      'SEED Гость без карточки',
      '+7 (999) SEED-9999',
      '2026-03-31',
      '16:00',
      30,
      1500,
      'pending',
      'SEED_APPT_3'
    );
  END IF;

  RAISE NOTICE 'Seed готов: business_id=%, услуги, мастера, клиенты, записи (SEED_*)', bid;
END $$;
