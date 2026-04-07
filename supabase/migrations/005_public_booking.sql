-- ============================================================
-- 005 — Публичная воронка записи: anon SELECT + RPC без сессии клиента
-- После: 004_rls_auth.sql
-- ============================================================

-- 1) Чтение карточки салона и витрины (только активные)
DROP POLICY IF EXISTS businesses_public_read ON public.businesses;
CREATE POLICY businesses_public_read ON public.businesses
  FOR SELECT TO anon
  USING (status = 'active');

-- 2) Услуги и мастера для активных салонов
DROP POLICY IF EXISTS services_public_read ON public.services;
CREATE POLICY services_public_read ON public.services
  FOR SELECT TO anon
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = services.business_id AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS staff_public_read ON public.staff;
CREATE POLICY staff_public_read ON public.staff
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = staff.business_id AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS staff_services_public_read ON public.staff_services;
CREATE POLICY staff_services_public_read ON public.staff_services
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      JOIN public.businesses b ON b.id = s.business_id
      WHERE s.id = staff_services.staff_id AND b.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.services sv
      JOIN public.businesses b2 ON b2.id = sv.business_id
      WHERE sv.id = staff_services.service_id AND b2.status = 'active'
    )
  );

-- 3) Справочник слотов — гостям (как у authenticated)
DROP POLICY IF EXISTS time_slots_read_anon ON public.time_slots;
CREATE POLICY time_slots_read_anon ON public.time_slots
  FOR SELECT TO anon
  USING (true);

-- 4) Занятые слоты по slug (без JWT клиента)
CREATE OR REPLACE FUNCTION public.get_public_busy_slot_times(
  p_slug text,
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
  WHERE a.business_id = (
      SELECT b.id
      FROM public.businesses b
      WHERE lower(trim(b.slug)) = lower(trim(p_slug))
        AND b.status = 'active'
      LIMIT 1
    )
    AND (a.date)::date = p_date
    AND COALESCE(a.status, '') <> 'cancelled'
    AND (
      p_staff_id IS NULL
      OR a.staff_id = p_staff_id
    );
$$;

REVOKE ALL ON FUNCTION public.get_public_busy_slot_times(text, date, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_busy_slot_times(text, date, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_busy_slot_times(text, date, bigint) TO authenticated;

-- 5) Создание записи гостем (валидация внутри функции)
CREATE OR REPLACE FUNCTION public.create_public_appointment(
  p_slug text,
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_service_id bigint,
  p_staff_id bigint,
  p_date date,
  p_time text,
  p_duration int,
  p_price numeric,
  p_notes text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid bigint;
  v_name text;
  v_phone text;
  v_email text;
  v_time text;
  v_dur int;
  v_price numeric;
  new_id bigint;
BEGIN
  p_slug := lower(trim(p_slug));
  IF p_slug = '' THEN
    RAISE EXCEPTION 'validation_error: не указан slug салона';
  END IF;

  SELECT b.id INTO v_bid
  FROM public.businesses b
  WHERE lower(trim(b.slug)) = p_slug AND b.status = 'active'
  LIMIT 1;

  IF v_bid IS NULL THEN
    RAISE EXCEPTION 'not_found: салон не найден';
  END IF;

  v_name := trim(coalesce(p_client_name, ''));
  IF length(v_name) = 0 OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'validation_error: укажите имя (до 200 символов)';
  END IF;

  v_phone := trim(coalesce(p_client_phone, ''));
  IF length(v_phone) < 5 OR length(v_phone) > 32 THEN
    RAISE EXCEPTION 'validation_error: укажите корректный телефон';
  END IF;

  v_email := nullif(trim(coalesce(p_client_email, '')), '');
  IF v_email IS NOT NULL AND (length(v_email) > 254 OR strpos(v_email, '@') < 2) THEN
    RAISE EXCEPTION 'validation_error: некорректный email';
  END IF;

  v_time := trim(coalesce(p_time, ''));
  IF v_time !~ '^\d{1,2}:\d{2}$' THEN
    RAISE EXCEPTION 'validation_error: время в формате ЧЧ:ММ';
  END IF;

  v_dur := coalesce(p_duration, 30);
  IF v_dur <= 0 OR v_dur > 24 * 60 THEN
    RAISE EXCEPTION 'validation_error: некорректная длительность';
  END IF;

  v_price := coalesce(p_price, 0);
  IF v_price < 0 THEN
    RAISE EXCEPTION 'validation_error: цена не может быть отрицательной';
  END IF;

  IF p_service_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = p_service_id AND s.business_id = v_bid AND s.active = true
    ) THEN
      RAISE EXCEPTION 'validation_error: услуга недоступна';
    END IF;
  END IF;

  IF p_staff_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff st WHERE st.id = p_staff_id AND st.business_id = v_bid
    ) THEN
      RAISE EXCEPTION 'validation_error: мастер недоступен';
    END IF;
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'validation_error: укажите дату';
  END IF;

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
  ) VALUES (
    v_bid,
    CASE WHEN p_service_id IS NULL THEN NULL ELSE p_service_id END,
    CASE WHEN p_staff_id IS NULL THEN NULL ELSE p_staff_id END,
    NULL,
    v_name,
    v_phone,
    v_email,
    p_date,
    v_time,
    v_dur,
    v_price,
    'pending',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_appointment(
  text, text, text, text, bigint, bigint, date, text, int, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(
  text, text, text, text, bigint, bigint, date, text, int, numeric, text
) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(
  text, text, text, text, bigint, bigint, date, text, int, numeric, text
) TO authenticated;
