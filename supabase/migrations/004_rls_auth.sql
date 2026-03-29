-- ============================================================
-- 004 — RLS: только владелец салона (auth.uid → businesses → business_id)
-- Без публичных SELECT/INSERT для anon: гость с anon-ключом не видит строк.
-- После: 001_relations.sql и 003_plans.sql (таблица plans нужна для политик).
-- ============================================================

-- 1) Slug (удобство URL; доступ только у владельца через RLS)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_slug_unique
  ON public.businesses (slug)
  WHERE slug IS NOT NULL AND length(trim(slug)) > 0;

UPDATE public.businesses
SET slug = 'business-' || id::text
WHERE slug IS NULL OR trim(slug) = '';

-- 2) Занятые слоты: только для своего business_id (вызывающий = владелец)
CREATE OR REPLACE FUNCTION public.get_busy_slot_times(
  p_business_id bigint,
  p_date date,
  p_staff_id bigint DEFAULT NULL
)
RETURNS TABLE(slot_time text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.time::text AS slot_time
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = p_business_id AND b.user_id = auth.uid()
    )
    AND (a.date)::date = p_date
    AND COALESCE(a.status, '') <> 'cancelled'
    AND (
      p_staff_id IS NULL
      OR a.staff_id = p_staff_id
    );
$$;

REVOKE ALL ON FUNCTION public.get_busy_slot_times(bigint, date, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_busy_slot_times(bigint, date, bigint) TO authenticated;

-- 3) Убрать старые политики README и предыдущие имена
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'Public read'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS businesses_public_select ON public.businesses;
DROP POLICY IF EXISTS services_public_select ON public.services;
DROP POLICY IF EXISTS staff_public_select ON public.staff;
DROP POLICY IF EXISTS clients_public_insert ON public.clients;
DROP POLICY IF EXISTS appointments_public_insert ON public.appointments;
DROP POLICY IF EXISTS staff_services_public_select ON public.staff_services;

-- 4) RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_businesses') THEN
    ALTER TABLE public.admin_businesses ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'revenue_data') THEN
    ALTER TABLE public.revenue_data ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 5) businesses — только свой user_id
DROP POLICY IF EXISTS businesses_owner_select ON public.businesses;
DROP POLICY IF EXISTS businesses_owner_insert ON public.businesses;
DROP POLICY IF EXISTS businesses_owner_update ON public.businesses;
DROP POLICY IF EXISTS businesses_owner_delete ON public.businesses;

CREATE POLICY businesses_owner_select ON public.businesses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY businesses_owner_insert ON public.businesses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY businesses_owner_update ON public.businesses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY businesses_owner_delete ON public.businesses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6) services
DROP POLICY IF EXISTS services_owner_all ON public.services;

CREATE POLICY services_owner_all ON public.services
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- 7) staff
DROP POLICY IF EXISTS staff_owner_all ON public.staff;

CREATE POLICY staff_owner_all ON public.staff
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- 8) clients
DROP POLICY IF EXISTS clients_owner_all ON public.clients;

CREATE POLICY clients_owner_all ON public.clients
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- 9) appointments
DROP POLICY IF EXISTS appointments_owner_all ON public.appointments;

CREATE POLICY appointments_owner_all ON public.appointments
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- 10) staff_services
DROP POLICY IF EXISTS staff_services_owner_all ON public.staff_services;

CREATE POLICY staff_services_owner_all ON public.staff_services
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.businesses b ON b.id = s.business_id
      WHERE s.id = staff_services.staff_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.businesses b ON b.id = s.business_id
      WHERE s.id = staff_services.staff_id AND b.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.services sv
      JOIN public.businesses b2 ON b2.id = sv.business_id
      WHERE sv.id = staff_services.service_id AND b2.user_id = auth.uid()
    )
  );

-- 11) time_slots — чтение только у вошедших (справочник)
DROP POLICY IF EXISTS time_slots_read ON public.time_slots;
CREATE POLICY time_slots_read ON public.time_slots
  FOR SELECT TO authenticated
  USING (true);

-- 12) plans — только чтение, только authenticated (каталог тарифов)
DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans
  FOR SELECT TO authenticated
  USING (true);

-- admin_* без политик — нет строк через anon/authenticated API
