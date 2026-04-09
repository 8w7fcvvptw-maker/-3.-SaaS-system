import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { requireUser } from './auth.js';
import { getUserRole, getActiveSubscription } from './subscriptions.js';

export const ROLES = {
  CLIENT: 'client',
  BUSINESS: 'business',
  ADMIN: 'admin',
};

function isSubscriptionEnforced() {
  return import.meta.env?.VITE_ENFORCE_SUBSCRIPTION !== 'false';
}

/**
 * Получить роль текущего аутентифицированного пользователя.
 * Использует Supabase RPC для чтения из user_profiles.
 */
export async function getMyRole() {
  const user = await requireUser();
  return getUserRole(user.id);
}

/**
 * Требовать определённую роль. Кидает ApiError если роль не совпадает.
 * ADMIN проходит любую проверку.
 */
export async function requireRole(...allowedRoles) {
  const role = await getMyRole();
  if (role === ROLES.ADMIN) return role;
  if (!allowedRoles.includes(role)) {
    throw new ApiError(
      `Доступ запрещён. Требуется роль: ${allowedRoles.join(' или ')}.`,
      { code: 'forbidden', status: 403 }
    );
  }
  return role;
}

/**
 * Middleware-функция: требовать активную подписку для BUSINESS пользователей.
 * ADMIN всегда проходит.
 * CLIENT не затрагивается (у них другие ограничения).
 */
export async function requireActiveSubscription() {
  if (!isSubscriptionEnforced()) {
    const user = await requireUser();
    return { user, role: ROLES.ADMIN, subscription: null };
  }

  const user = await requireUser();
  const role = await getUserRole(user.id);

  if (role === ROLES.ADMIN) return { user, role, subscription: null };
  if (role === ROLES.CLIENT) return { user, role, subscription: null };

  // role === 'business' — нужна активная подписка
  const sub = await getActiveSubscription();
  if (!sub) {
    throw new ApiError(
      'Доступ запрещён: нет активной подписки. Выберите тарифный план для продолжения работы.',
      { code: 'subscription_required', status: 403 }
    );
  }

  return { user, role, subscription: sub };
}

/**
 * Обновить роль пользователя (только admin может менять роли).
 */
export async function setUserRole(targetUserId, newRole) {
  const myRole = await getMyRole();
  if (myRole !== ROLES.ADMIN) {
    throw new ApiError('Только администратор может изменять роли.', { code: 'forbidden', status: 403 });
  }

  if (!Object.values(ROLES).includes(newRole)) {
    throw new ApiError(`Недопустимая роль: ${newRole}`, { code: 'validation_error', status: 400 });
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)
    .select()
    .single();

  if (error) throw new ApiError(error.message, { code: 'validation_error', status: 400 });
  return data;
}

/**
 * Получить профиль текущего пользователя с ролью и подпиской.
 */
export async function getMyProfile() {
  const user = await requireUser();
  const [role, subscription] = await Promise.all([
    getUserRole(user.id),
    getActiveSubscription(),
  ]);

  return {
    id: user.id,
    email: user.email,
    role,
    subscription,
    hasActiveSubscription: subscription !== null,
  };
}
