-- ============================================
-- 006 — SaaS Монетизация: роли, подписки, платежи, квоты
-- Выполнить после 005_public_booking.sql
-- Supabase: SQL Editor → New query → Run
-- ============================================

-- 1) Таблица профилей пользователей (расширение auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'business', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Триггер: автоматически создаём профиль при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2) Таблица подписок
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'canceled', 'trial')),
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'unlimited')),
  start_date timestamptz,
  end_date timestamptz,
  yokassa_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);

-- 3) Таблица платежей
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  yokassa_payment_id text UNIQUE,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RUB',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'canceled', 'refunded')),
  plan text NOT NULL CHECK (plan IN ('basic', 'pro', 'unlimited')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS payments_yokassa_id_idx ON public.payments (yokassa_payment_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);

-- 4) Квоты тарифных планов
CREATE TABLE IF NOT EXISTS public.plan_quotas (
  plan text PRIMARY KEY CHECK (plan IN ('basic', 'pro', 'unlimited')),
  appointments_per_month integer NOT NULL DEFAULT 50,
  services_limit integer NOT NULL DEFAULT 10,
  staff_limit integer NOT NULL DEFAULT 2,
  price_rub numeric(10, 2) NOT NULL DEFAULT 0,
  display_name text NOT NULL
);

INSERT INTO public.plan_quotas (plan, appointments_per_month, services_limit, staff_limit, price_rub, display_name)
VALUES
  ('basic',     50,   10,   2,   990.00,  'Basic'),
  ('pro',       300,  50,   10,  2990.00, 'Pro'),
  ('unlimited', -1,   -1,   -1,  9990.00, 'Unlimited')
ON CONFLICT (plan) DO UPDATE SET
  appointments_per_month = EXCLUDED.appointments_per_month,
  services_limit         = EXCLUDED.services_limit,
  staff_limit            = EXCLUDED.staff_limit,
  price_rub              = EXCLUDED.price_rub,
  display_name           = EXCLUDED.display_name;

-- 5) Функция: проверить активную подписку пользователя
CREATE OR REPLACE FUNCTION public.get_active_subscription(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  plan text,
  status text,
  end_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT s.id, s.plan, s.status, s.end_date
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.end_date IS NULL OR s.end_date > now())
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- 6) Функция: получить статистику для админа
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_revenue numeric;
  v_active_subs integer;
  v_total_business integer;
  v_total_users integer;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue
  FROM public.payments WHERE status = 'succeeded';

  SELECT COUNT(*) INTO v_active_subs
  FROM public.subscriptions
  WHERE status = 'active' AND (end_date IS NULL OR end_date > now());

  SELECT COUNT(*) INTO v_total_business
  FROM public.user_profiles WHERE role = 'business';

  SELECT COUNT(*) INTO v_total_users
  FROM public.user_profiles;

  RETURN jsonb_build_object(
    'totalRevenue', v_total_revenue,
    'activeSubscriptions', v_active_subs,
    'totalBusinessUsers', v_total_business,
    'totalUsers', v_total_users
  );
END;
$$;

-- 7) Функция: обновить updated_at автоматически
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Существующим пользователям создаём профили если не были созданы
INSERT INTO public.user_profiles (id, role)
SELECT id, 'client' FROM auth.users
ON CONFLICT (id) DO NOTHING;
