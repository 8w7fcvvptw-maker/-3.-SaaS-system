import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { throwOnError } from './helpers.js';
import { requireRole, ROLES } from './roles.js';

const PLAN_TO_UI_NAME = {
  basic: 'Free',
  pro: 'Pro',
  unlimited: 'Enterprise',
};

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
  const [businessesRes, subscriptionsRes] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, user_id, name, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('user_id, plan, status, end_date, created_at')
      .order('created_at', { ascending: false }),
  ]);

  const businesses = throwOnError(businessesRes) ?? [];
  const subscriptions = throwOnError(subscriptionsRes) ?? [];

  const latestSubByUser = new Map();
  for (const sub of subscriptions) {
    if (!sub?.user_id) continue;
    if (!latestSubByUser.has(sub.user_id)) {
      latestSubByUser.set(sub.user_id, sub);
    }
  }

  return businesses.map((business) => {
    const latestSub = latestSubByUser.get(business.user_id) ?? null;
    const endDate = latestSub?.end_date ? new Date(latestSub.end_date) : null;
    const hasEntitlement =
      (latestSub?.status === 'active' || latestSub?.status === 'trial') &&
      (!endDate || endDate > new Date());
    return {
      id: business.id,
      name: business.name ?? `Business #${business.id}`,
      plan: PLAN_TO_UI_NAME[latestSub?.plan] ?? 'Free',
      users: 1,
      created: business.created_at
        ? new Date(business.created_at).toLocaleDateString('ru-RU')
        : '—',
      revenue: 0,
      status: hasEntitlement ? 'active' : 'inactive',
    };
  });
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
