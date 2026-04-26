-- ============================================
-- 012 — SaaS access entitlements hardening
-- Role = user type (legacy-compatible), subscription = access state.
-- ============================================

-- 1) Нормализуем значения статуса подписки.
UPDATE public.subscriptions
SET status = 'canceled'
WHERE status = 'cancelled';

-- Истёкшие trial/active переводим в past_due для корректного paywall.
UPDATE public.subscriptions
SET status = 'past_due'
WHERE status IN ('active', 'trial')
  AND end_date IS NOT NULL
  AND end_date < now();

-- 2) Обновляем CHECK-constraint статусов.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'trial', 'past_due', 'canceled', 'inactive'));

-- 3) Вспомогательная функция для единообразной серверной логики доступа.
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH ranked AS (
    SELECT
      CASE
        WHEN s.end_date IS NOT NULL
             AND s.end_date < now()
             AND s.status IN ('active', 'trial') THEN 'past_due'
        WHEN s.status = 'cancelled' THEN 'canceled'
        ELSE s.status
      END AS normalized_status,
      s.created_at
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
  )
  SELECT COALESCE(
    (
      SELECT normalized_status
      FROM ranked
      ORDER BY
        CASE normalized_status
          WHEN 'active' THEN 1
          WHEN 'trial' THEN 2
          WHEN 'past_due' THEN 3
          WHEN 'canceled' THEN 4
          ELSE 5
        END,
        created_at DESC
      LIMIT 1
    ),
    'inactive'
  );
$$;
