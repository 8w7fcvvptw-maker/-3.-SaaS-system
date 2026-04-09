-- ============================================
-- 007 — RLS политики для SaaS-монетизации
-- Выполнить после 006_saas_monetization.sql
-- ============================================

-- Включить RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_quotas ENABLE ROW LEVEL SECURITY;

-- --------- user_profiles ---------
-- Пользователь видит только свой профиль
CREATE POLICY "profiles_select_own" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Пользователь может обновить свой профиль (кроме role — только через сервис/admin)
CREATE POLICY "profiles_update_own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ВАЖНО: не делаем policy с self-query на user_profiles (это вызывает infinite recursion).
-- admin-операции по user_profiles идут через service_role на сервере.

-- --------- subscriptions ---------
-- Пользователь видит свои подписки
CREATE POLICY "subs_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin видит все
CREATE POLICY "subs_admin_all" ON public.subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Только сервисный ключ/функции SECURITY DEFINER могут insert/update
CREATE POLICY "subs_service_insert" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --------- payments ---------
-- Пользователь видит свои платежи
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Admin видит все
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Пользователь может создавать платёж (статус pending — до webhook)
CREATE POLICY "payments_service_insert" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --------- plan_quotas ---------
-- Все аутентифицированные читают квоты
CREATE POLICY "quotas_select_all" ON public.plan_quotas
  FOR SELECT USING (auth.role() = 'authenticated');

-- Только admin меняет квоты
CREATE POLICY "quotas_admin_update" ON public.plan_quotas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- --------- Функция: получить роль текущего пользователя ---------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;
