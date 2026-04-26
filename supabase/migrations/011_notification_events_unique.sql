-- ============================================
-- 011 — Защита от дублей очереди уведомлений
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_template_appointment_event_uniq
  ON public.notification_events (template_id, appointment_id, event_type)
  WHERE template_id IS NOT NULL AND appointment_id IS NOT NULL;
