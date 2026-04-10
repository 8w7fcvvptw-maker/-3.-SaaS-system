import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { throwOnError } from './helpers.js';
import { requireRole, ROLES } from './roles.js';

/** Статистика платформы для Admin */
export async function getAdminStats() {
  await requireRole(ROLES.ADMIN);

  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });

  return {
    totalRevenue: data?.totalRevenue ?? 0,
    activeSubscriptions: data?.activeSubscriptions ?? 0,
    totalBusinessUsers: data?.totalBusinessUsers ?? 0,
    totalUsers: data?.totalUsers ?? 0,
  };
}

/** Список всех бизнес-пользователей с подписками */
export async function getAdminBusinesses() {
  await requireRole(ROLES.ADMIN);

  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      id,
      role,
      created_at,
      subscriptions (
        id,
        plan,
        status,
        start_date,
        end_date
      )
    `)
    .eq('role', 'business')
    .order('created_at', { ascending: false });

  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });
  return data ?? [];
}

/** Список всех платежей для Admin */
export async function getAdminPayments() {
  await requireRole(ROLES.ADMIN);

  return throwOnError(
    await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
  );
}

/** Обновить роль пользователя (только Admin) */
export async function adminSetUserRole(targetUserId, newRole) {
  await requireRole(ROLES.ADMIN);
  const { setUserRole } = await import('./roles.js');
  return setUserRole(targetUserId, newRole);
}
