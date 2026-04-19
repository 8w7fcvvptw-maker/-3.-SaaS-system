-- ============================================================
-- 009 — Публичная запись: при «любом мастере» подставлять staff_id
-- Иначе INSERT даёт NULL в staff_id при NOT NULL в таблице.
-- ============================================================

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
  v_staff_id bigint;
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

  -- Явно выбранный мастер
  v_staff_id := p_staff_id;

  IF v_staff_id IS NULL AND p_service_id IS NOT NULL THEN
    SELECT ss.staff_id INTO v_staff_id
    FROM public.staff_services ss
    INNER JOIN public.staff st ON st.id = ss.staff_id AND st.business_id = v_bid
    WHERE ss.service_id = p_service_id
    ORDER BY ss.staff_id
    LIMIT 1;

    IF v_staff_id IS NULL THEN
      RAISE EXCEPTION 'validation_error: для этой услуги не назначены мастера';
    END IF;
  END IF;

  IF v_staff_id IS NULL THEN
    SELECT st.id INTO v_staff_id
    FROM public.staff st
    WHERE st.business_id = v_bid
    ORDER BY st.id
    LIMIT 1;

    IF v_staff_id IS NULL THEN
      RAISE EXCEPTION 'validation_error: в салоне нет мастеров';
    END IF;
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
    v_staff_id,
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
