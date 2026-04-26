-- ============================================
-- 010 — Уведомления: шаблоны и лог событий
-- ============================================

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id bigint NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  name text NOT NULL,
  trigger_event text NOT NULL,
  trigger_offset_minutes integer NOT NULL DEFAULT 0,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'sms_email')),
  subject text,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  provider text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_templates_business_template_key_uniq UNIQUE (business_id, template_key)
);

CREATE TABLE IF NOT EXISTS public.notification_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id bigint NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_id bigint REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  appointment_id bigint REFERENCES public.appointments(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'sms_email')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  recipient text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_templates_business_id_idx
  ON public.notification_templates (business_id);

CREATE INDEX IF NOT EXISTS notification_events_business_created_idx
  ON public.notification_events (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_events_status_idx
  ON public.notification_events (status);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_templates_owner_select ON public.notification_templates;
CREATE POLICY notification_templates_owner_select ON public.notification_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = notification_templates.business_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notification_templates_owner_insert ON public.notification_templates;
CREATE POLICY notification_templates_owner_insert ON public.notification_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = notification_templates.business_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notification_templates_owner_update ON public.notification_templates;
CREATE POLICY notification_templates_owner_update ON public.notification_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = notification_templates.business_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = notification_templates.business_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notification_templates_owner_delete ON public.notification_templates;
CREATE POLICY notification_templates_owner_delete ON public.notification_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = notification_templates.business_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notification_events_owner_select ON public.notification_events;
CREATE POLICY notification_events_owner_select ON public.notification_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = notification_events.business_id
        AND b.user_id = auth.uid()
    )
  );

-- Дефолтные шаблоны для уже существующих бизнесов
INSERT INTO public.notification_templates (
  business_id, template_key, name, trigger_event, trigger_offset_minutes, channel, subject, body, active
)
SELECT
  b.id,
  t.template_key,
  t.name,
  t.trigger_event,
  t.trigger_offset_minutes,
  t.channel,
  t.subject,
  t.body,
  t.active
FROM public.businesses b
CROSS JOIN (
  VALUES
    ('appointment_created',      'Подтверждение записи',      'appointment_created',   0,     'sms_email', 'Подтверждение записи', 'Ваша запись подтверждена. Ждём вас в назначенное время.', true),
    ('appointment_reminder_24h', 'Напоминание за 24 часа',    'appointment_reminder', -1440,  'sms',       'Напоминание о записи', 'Напоминаем о записи завтра. Если планы изменились, пожалуйста, отмените визит заранее.', true),
    ('appointment_cancelled',    'Отмена записи',             'appointment_cancelled', 0,      'sms_email', 'Запись отменена',      'Ваша запись была отменена. Вы можете выбрать новое удобное время.', true),
    ('post_visit_followup',      'Follow-up после визита',    'appointment_followup',  1440,   'email',     'Спасибо за визит',     'Спасибо, что были у нас. Будем рады отзыву и новой встрече.', false)
) AS t(template_key, name, trigger_event, trigger_offset_minutes, channel, subject, body, active)
ON CONFLICT (business_id, template_key) DO NOTHING;
