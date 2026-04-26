import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { requireUser } from './auth.js';
import { getUserRole, getMyAccessProfile } from './subscriptions.js';

export const ROLES = {
  CLIENT: 'client',
  BUSINESS: 'business',
  ADMIN: 'admin',
};

/**
 * Получить роль текущего аутентифицированного пользователя.
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
  const access = await getMyAccessProfile();

  return {
    id: user.id,
    email: user.email,
    role: access?.role ?? 'client',
    userType: access?.userType ?? 'customer',
    businessId: access?.businessId ?? null,
    hasBusiness: access?.hasBusiness ?? false,
    subscriptionStatus: access?.subscriptionStatus ?? 'inactive',
    subscription: access?.subscription ?? null,
    hasOwnerEntitlement: access?.hasOwnerEntitlement ?? false,
    hasActiveSubscription: access?.hasActiveSubscription ?? false,
    access: access?.access ?? null,
  };
}
