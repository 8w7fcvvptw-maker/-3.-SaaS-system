-- ============================================
-- 008 — Hotfix: убрать рекурсию RLS в user_profiles
-- Причина: policy "profiles_admin_all" делала SELECT из user_profiles
-- на самой же таблице, что даёт infinite recursion.
-- ============================================

-- 1) Удаляем проблемную policy
DROP POLICY IF EXISTS "profiles_admin_all" ON public.user_profiles;

-- 2) На всякий случай нормализуем базовые policy (идемпотентно)
DROP POLICY IF EXISTS "profiles_select_own" ON public.user_profiles;
CREATE POLICY "profiles_select_own" ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.user_profiles;
CREATE POLICY "profiles_update_own" ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3) Проверяем, что RLS включён
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

