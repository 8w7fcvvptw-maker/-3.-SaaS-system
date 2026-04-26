-- ============================================
-- 013 — Owner entitlement in RLS policies
-- Блокируем доступ owner-контура без trial/active.
-- ============================================

CREATE OR REPLACE FUNCTION public.has_owner_entitlement(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_has_business boolean;
  v_status text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT up.role
  INTO v_role
  FROM public.user_profiles up
  WHERE up.id = p_user_id;

  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.user_id = p_user_id
  )
  INTO v_has_business;

  IF NOT v_has_business THEN
    RETURN false;
  END IF;

  SELECT public.get_subscription_status(p_user_id)
  INTO v_status;

  RETURN v_status IN ('active', 'trial');
END;
$$;

DROP POLICY IF EXISTS services_owner_all ON public.services;
CREATE POLICY services_owner_all ON public.services
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND public.has_owner_entitlement(auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND public.has_owner_entitlement(auth.uid())
  );

DROP POLICY IF EXISTS staff_owner_all ON public.staff;
CREATE POLICY staff_owner_all ON public.staff
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND public.has_owner_entitlement(auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND public.has_owner_entitlement(auth.uid())
  );

DROP POLICY IF EXISTS clients_owner_all ON public.clients;
CREATE POLICY clients_owner_all ON public.clients
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND public.has_owner_entitlement(auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND public.has_owner_entitlement(auth.uid())
  );

DROP POLICY IF EXISTS appointments_owner_all ON public.appointments;
CREATE POLICY appointments_owner_all ON public.appointments
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND public.has_owner_entitlement(auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND public.has_owner_entitlement(auth.uid())
  );

DROP POLICY IF EXISTS staff_services_owner_all ON public.staff_services;
CREATE POLICY staff_services_owner_all ON public.staff_services
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.businesses b ON b.id = s.business_id
      WHERE s.id = staff_services.staff_id
        AND b.user_id = auth.uid()
    )
    AND public.has_owner_entitlement(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.businesses b ON b.id = s.business_id
      WHERE s.id = staff_services.staff_id
        AND b.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.services sv
      JOIN public.businesses b2 ON b2.id = sv.business_id
      WHERE sv.id = staff_services.service_id
        AND b2.user_id = auth.uid()
    )
    AND public.has_owner_entitlement(auth.uid())
  );
