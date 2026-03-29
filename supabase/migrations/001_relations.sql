-- ============================================
-- 001 — Supabase relations migration (safe-ish)
-- Папка: supabase/migrations/ (выполняйте по порядку номеров)
-- Supabase: SQL Editor → New query → Run
-- ============================================

-- 1) appointments.client_id (связь записи с клиентом)
ALTER TABLE IF EXISTS public.appointments
  ADD COLUMN IF NOT EXISTS client_id bigint;

-- Индекс для быстрых выборок по клиенту
CREATE INDEX IF NOT EXISTS appointments_client_id_idx
  ON public.appointments (client_id);

-- 2) Foreign keys (через DO-блоки, чтобы повторный запуск не падал)
DO $$
BEGIN
  ALTER TABLE public.services
    ADD CONSTRAINT services_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.businesses(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.staff
    ADD CONSTRAINT staff_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.businesses(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.businesses(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.businesses(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_service_id_fkey
    FOREIGN KEY (service_id) REFERENCES public.services(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.staff(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) staff_services (many-to-many)
DO $$
BEGIN
  ALTER TABLE public.staff_services
    ADD CONSTRAINT staff_services_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.staff(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.staff_services
    ADD CONSTRAINT staff_services_service_id_fkey
    FOREIGN KEY (service_id) REFERENCES public.services(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Уникальность пары (чтобы не было дублей)
CREATE UNIQUE INDEX IF NOT EXISTS staff_services_unique_pair
  ON public.staff_services (staff_id, service_id);

-- 4) Recommended indices (не обязательны, но ускоряют списки)
CREATE INDEX IF NOT EXISTS appointments_business_date_time_idx
  ON public.appointments (business_id, date, time);

CREATE INDEX IF NOT EXISTS services_business_id_idx
  ON public.services (business_id);

CREATE INDEX IF NOT EXISTS staff_business_id_idx
  ON public.staff (business_id);

CREATE INDEX IF NOT EXISTS clients_business_id_idx
  ON public.clients (business_id);
