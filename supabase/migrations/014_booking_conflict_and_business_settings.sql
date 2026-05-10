-- ============================================
-- 014 — Booking conflict hardening + business booking settings
-- ============================================

-- 1) Персистентные настройки онлайн-записи на бизнес.
CREATE TABLE IF NOT EXISTS public.business_booking_settings (
  business_id bigint PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  online_booking_enabled boolean NOT NULL DEFAULT true,
  buffer_minutes integer NOT NULL DEFAULT 15 CHECK (buffer_minutes >= 0 AND buffer_minutes <= 180),
  cancellation_hours integer NOT NULL DEFAULT 24 CHECK (cancellation_hours >= 0 AND cancellation_hours <= 720),
  reminder_hours integer NOT NULL DEFAULT 24 CHECK (reminder_hours >= 0 AND reminder_hours <= 720),
  notifications_email_enabled boolean NOT NULL DEFAULT true,
  notifications_sms_enabled boolean NOT NULL DEFAULT true,
  sms_addon_enabled boolean NOT NULL DEFAULT false,
  advanced_notifications_enabled boolean NOT NULL DEFAULT false,
  deposit_enabled boolean NOT NULL DEFAULT false,
  deposit_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  self_service_links_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.business_booking_settings (business_id)
SELECT b.id
FROM public.businesses b
ON CONFLICT (business_id) DO NOTHING;

ALTER TABLE public.business_booking_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_settings_owner_select ON public.business_booking_settings;
CREATE POLICY booking_settings_owner_select ON public.business_booking_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_booking_settings.business_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS booking_settings_owner_insert ON public.business_booking_settings;
CREATE POLICY booking_settings_owner_insert ON public.business_booking_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_booking_settings.business_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS booking_settings_owner_update ON public.business_booking_settings;
CREATE POLICY booking_settings_owner_update ON public.business_booking_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_booking_settings.business_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_booking_settings.business_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS booking_settings_public_read ON public.business_booking_settings;
CREATE POLICY booking_settings_public_read ON public.business_booking_settings
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_booking_settings.business_id
        AND b.status = 'active'
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS business_booking_settings_updated_at ON public.business_booking_settings;
    CREATE TRIGGER business_booking_settings_updated_at
      BEFORE UPDATE ON public.business_booking_settings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 2) Серверная защита от пересекающихся записей с учётом buffer.
CREATE OR REPLACE FUNCTION public.enforce_appointment_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buffer integer := 0;
  v_new_start timestamp;
  v_new_end timestamp;
  v_conflict_id bigint;
BEGIN
  IF NEW.status IN ('cancelled', 'canceled') THEN
    RETURN NEW;
  END IF;

  IF NEW.staff_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.date IS NULL OR NEW.time IS NULL THEN
    RAISE EXCEPTION 'appointment_conflict: дата и время обязательны';
  END IF;

  IF COALESCE(NEW.duration, 0) <= 0 THEN
    RAISE EXCEPTION 'appointment_conflict: длительность должна быть > 0';
  END IF;

  PERFORM pg_advisory_xact_lock(COALESCE(NEW.business_id, 0)::integer, COALESCE(NEW.staff_id, 0)::integer);

  SELECT s.buffer_minutes
  INTO v_buffer
  FROM public.business_booking_settings s
  WHERE s.business_id = NEW.business_id;

  v_buffer := COALESCE(v_buffer, 0);
  v_new_start := (NEW.date::text || ' ' || NEW.time)::timestamp;
  v_new_end := v_new_start + make_interval(mins => NEW.duration);

  SELECT a.id
  INTO v_conflict_id
  FROM public.appointments a
  WHERE a.business_id = NEW.business_id
    AND a.staff_id = NEW.staff_id
    AND COALESCE(a.status, '') NOT IN ('cancelled', 'canceled')
    AND (TG_OP = 'INSERT' OR a.id <> NEW.id)
    AND tstzrange(v_new_start, v_new_end, '[)') &&
        tstzrange(
          (a.date::text || ' ' || a.time)::timestamp - make_interval(mins => v_buffer),
          ((a.date::text || ' ' || a.time)::timestamp + make_interval(mins => COALESCE(a.duration, 0))) + make_interval(mins => v_buffer),
          '[)'
        )
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'appointment_conflict: это время занято с учётом буфера';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_conflict_guard ON public.appointments;
CREATE TRIGGER appointments_conflict_guard
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_conflict();

-- 3) Busy slots v2 — учитывает duration/buffer и сценарий "любой мастер".
CREATE OR REPLACE FUNCTION public.get_busy_slot_times_v2(
  p_business_id bigint,
  p_date date,
  p_staff_id bigint DEFAULT NULL,
  p_service_id bigint DEFAULT NULL,
  p_duration integer DEFAULT 30
)
RETURNS TABLE(slot_time text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH settings AS (
    SELECT COALESCE(s.buffer_minutes, 0) AS buffer_minutes
    FROM public.business_booking_settings s
    WHERE s.business_id = p_business_id
  ),
  owner_check AS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.user_id = auth.uid()
  ),
  candidate_staff AS (
    SELECT st.id AS staff_id
    FROM public.staff st
    WHERE st.business_id = p_business_id
      AND (
        p_staff_id IS NOT NULL AND st.id = p_staff_id
        OR p_staff_id IS NULL AND p_service_id IS NULL
        OR p_staff_id IS NULL AND p_service_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.staff_services ss
          WHERE ss.staff_id = st.id AND ss.service_id = p_service_id
        )
      )
  ),
  slots AS (
    SELECT ts.slot AS slot_time
    FROM public.time_slots ts
  ),
  appointments_day AS (
    SELECT
      a.staff_id,
      (a.date::text || ' ' || a.time)::timestamp AS start_ts,
      ((a.date::text || ' ' || a.time)::timestamp + make_interval(mins => COALESCE(a.duration, 0))) AS end_ts
    FROM public.appointments a
    WHERE a.business_id = p_business_id
      AND (a.date)::date = p_date
      AND COALESCE(a.status, '') NOT IN ('cancelled', 'canceled')
  ),
  availability AS (
    SELECT
      s.slot_time,
      cs.staff_id,
      NOT EXISTS (
        SELECT 1
        FROM appointments_day a
        CROSS JOIN settings cfg
        WHERE a.staff_id = cs.staff_id
          AND tstzrange(
                (p_date::text || ' ' || s.slot_time)::timestamp,
                (p_date::text || ' ' || s.slot_time)::timestamp + make_interval(mins => GREATEST(COALESCE(p_duration, 30), 1)),
                '[)'
              )
              &&
              tstzrange(
                a.start_ts - make_interval(mins => cfg.buffer_minutes),
                a.end_ts + make_interval(mins => cfg.buffer_minutes),
                '[)'
              )
      ) AS is_free
    FROM slots s
    CROSS JOIN candidate_staff cs
    WHERE EXISTS (SELECT 1 FROM owner_check)
  ),
  free_by_slot AS (
    SELECT slot_time, count(*) FILTER (WHERE is_free) AS free_staff_count
    FROM availability
    GROUP BY slot_time
  )
  SELECT f.slot_time
  FROM free_by_slot f
  WHERE f.free_staff_count = 0
  ORDER BY f.slot_time;
$$;

REVOKE ALL ON FUNCTION public.get_busy_slot_times_v2(bigint, date, bigint, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_busy_slot_times_v2(bigint, date, bigint, bigint, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_busy_slot_times_v2(
  p_slug text,
  p_date date,
  p_staff_id bigint DEFAULT NULL,
  p_service_id bigint DEFAULT NULL,
  p_duration integer DEFAULT 30
)
RETURNS TABLE(slot_time text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH biz AS (
    SELECT b.id AS business_id
    FROM public.businesses b
    JOIN public.business_booking_settings s ON s.business_id = b.id
    WHERE lower(trim(b.slug)) = lower(trim(p_slug))
      AND b.status = 'active'
      AND s.online_booking_enabled = true
    LIMIT 1
  ),
  settings AS (
    SELECT COALESCE(s.buffer_minutes, 0) AS buffer_minutes
    FROM public.business_booking_settings s
    JOIN biz ON biz.business_id = s.business_id
  ),
  candidate_staff AS (
    SELECT st.id AS staff_id
    FROM public.staff st
    JOIN biz ON biz.business_id = st.business_id
    WHERE (
      p_staff_id IS NOT NULL AND st.id = p_staff_id
      OR p_staff_id IS NULL AND p_service_id IS NULL
      OR p_staff_id IS NULL AND p_service_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.staff_services ss
        WHERE ss.staff_id = st.id AND ss.service_id = p_service_id
      )
    )
  ),
  slots AS (
    SELECT ts.slot AS slot_time
    FROM public.time_slots ts
  ),
  appointments_day AS (
    SELECT
      a.staff_id,
      (a.date::text || ' ' || a.time)::timestamp AS start_ts,
      ((a.date::text || ' ' || a.time)::timestamp + make_interval(mins => COALESCE(a.duration, 0))) AS end_ts
    FROM public.appointments a
    JOIN biz ON biz.business_id = a.business_id
    WHERE (a.date)::date = p_date
      AND COALESCE(a.status, '') NOT IN ('cancelled', 'canceled')
  ),
  availability AS (
    SELECT
      s.slot_time,
      cs.staff_id,
      NOT EXISTS (
        SELECT 1
        FROM appointments_day a
        CROSS JOIN settings cfg
        WHERE a.staff_id = cs.staff_id
          AND tstzrange(
                (p_date::text || ' ' || s.slot_time)::timestamp,
                (p_date::text || ' ' || s.slot_time)::timestamp + make_interval(mins => GREATEST(COALESCE(p_duration, 30), 1)),
                '[)'
              )
              &&
              tstzrange(
                a.start_ts - make_interval(mins => cfg.buffer_minutes),
                a.end_ts + make_interval(mins => cfg.buffer_minutes),
                '[)'
              )
      ) AS is_free
    FROM slots s
    CROSS JOIN candidate_staff cs
  ),
  free_by_slot AS (
    SELECT slot_time, count(*) FILTER (WHERE is_free) AS free_staff_count
    FROM availability
    GROUP BY slot_time
  )
  SELECT f.slot_time
  FROM free_by_slot f
  WHERE f.free_staff_count = 0
  ORDER BY f.slot_time;
$$;

REVOKE ALL ON FUNCTION public.get_public_busy_slot_times_v2(text, date, bigint, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_busy_slot_times_v2(text, date, bigint, bigint, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_busy_slot_times_v2(text, date, bigint, bigint, integer) TO authenticated;

-- 4) Публичная запись: учитывает online booking и атомарно выбирает мастера.
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
  v_staff_id bigint;
  v_staff_candidates bigint[];
  new_id bigint;
BEGIN
  p_slug := lower(trim(p_slug));
  IF p_slug = '' THEN
    RAISE EXCEPTION 'validation_error: не указан slug салона';
  END IF;

  SELECT b.id INTO v_bid
  FROM public.businesses b
  JOIN public.business_booking_settings s ON s.business_id = b.id
  WHERE lower(trim(b.slug)) = p_slug
    AND b.status = 'active'
    AND s.online_booking_enabled = true
  LIMIT 1;

  IF v_bid IS NULL THEN
    RAISE EXCEPTION 'booking_disabled: онлайн-запись отключена или салон недоступен';
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
    v_staff_candidates := ARRAY[p_staff_id];
  ELSE
    IF p_service_id IS NOT NULL THEN
      SELECT array_agg(ss.staff_id ORDER BY ss.staff_id)
      INTO v_staff_candidates
      FROM public.staff_services ss
      JOIN public.staff st ON st.id = ss.staff_id
      WHERE ss.service_id = p_service_id
        AND st.business_id = v_bid;
    ELSE
      SELECT array_agg(st.id ORDER BY st.id)
      INTO v_staff_candidates
      FROM public.staff st
      WHERE st.business_id = v_bid;
    END IF;
  END IF;

  IF v_staff_candidates IS NULL OR array_length(v_staff_candidates, 1) IS NULL THEN
    RAISE EXCEPTION 'validation_error: нет доступных мастеров';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'validation_error: укажите дату';
  END IF;

  FOREACH v_staff_id IN ARRAY v_staff_candidates
  LOOP
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'appointment_conflict:%' THEN
        CONTINUE;
      END IF;
      RAISE;
    END;
  END LOOP;

  RAISE EXCEPTION 'booking_conflict: выбранное время уже занято';
END;
$$;
