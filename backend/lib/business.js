import { supabase } from './supabase.js';
import { throwOnError } from './helpers.js';
import { ApiError } from './errors.js';
import { requireSession } from './auth.js';
import {
  assertNonEmptyString,
  assertSlug,
  optionalString,
  optionalEmail,
  assertPhone,
  assertId,
} from './validation.js';

let cachedOwnerBusinessId = null;
let cachedOwnerBusinessUserId = null;

export function clearBusinessCache() {
  cachedOwnerBusinessId = null;
  cachedOwnerBusinessUserId = null;
}

/** Просмотр карточки по slug — только для вошедшего владельца (RLS отдаёт только свою строку). */
export async function getBusinessBySlug(slug) {
  await requireSession();
  if (slug == null || String(slug).trim() === '') {
    throw new ApiError('Не указан адрес салона (slug)', { field: 'slug', code: 'validation_error', status: 400 });
  }
  const s = String(slug).trim().toLowerCase();
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', s)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throwOnError({ data: null, error });
  return data ?? null;
}

/** Кабинет: без аргумента (только своя запись). Публично: строка slug. */
export async function getBusiness(slug) {
  if (slug != null && String(slug).trim() !== '') {
    return getBusinessBySlug(String(slug).trim().toLowerCase());
  }

  await requireSession();
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new ApiError('Требуется войти в аккаунт', { code: 'auth_required', status: 401 });

  if (cachedOwnerBusinessUserId === uid && cachedOwnerBusinessId != null) {
    const { data, error } = await supabase.from('businesses').select('*').eq('id', cachedOwnerBusinessId).maybeSingle();
    if (!error && data) return data;
  }

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', uid)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throwOnError({ data: null, error });
  if (data?.id != null) {
    cachedOwnerBusinessId = data.id;
    cachedOwnerBusinessUserId = uid;
  }
  return data ?? null;
}

export async function updateBusiness(id, updates) {
  const session = await requireSession();
  const bid = assertId(Number(id), 'id');
  const ownerBid = await getOwnerBusinessId();
  if (bid !== ownerBid) {
    throw new ApiError('Нельзя изменять чужой салон', { code: 'forbidden', status: 403 });
  }

  const safe = {};
  if (updates.name !== undefined) safe.name = assertNonEmptyString(updates.name, 'name', 200);
  if (updates.description !== undefined) safe.description = optionalString(updates.description, 'description', 2000);
  if (updates.address !== undefined) safe.address = optionalString(updates.address, 'address', 500);
  if (updates.phone !== undefined) safe.phone = updates.phone != null && String(updates.phone).trim() ? assertPhone(updates.phone, 'phone') : null;
  if (updates.email !== undefined) safe.email = optionalEmail(updates.email, 'email');
  if (updates.hours !== undefined) safe.hours = optionalString(updates.hours, 'hours', 500);
  if (updates.timezone !== undefined) safe.timezone = optionalString(updates.timezone, 'timezone', 100);
  if (updates.plan !== undefined) safe.plan = optionalString(updates.plan, 'plan', 100);
  if (updates.status !== undefined) safe.status = optionalString(updates.status, 'status', 50);
  if (updates.slug !== undefined) safe.slug = assertSlug(updates.slug);

  if (Object.keys(safe).length === 0) {
    throw new ApiError('Нет полей для обновления', { code: 'validation_error', status: 400 });
  }

  return throwOnError(
    await supabase.from('businesses').update(safe).eq('id', bid).eq('user_id', session.user.id).select().single()
  );
}

export async function createBusiness(payload) {
  const session = await requireSession();
  const uid = session.user.id;

  const existing = await supabase.from('businesses').select('id').eq('user_id', uid).limit(1).maybeSingle();
  if (existing.data?.id) {
    throw new ApiError('У вас уже есть салон. Используйте настройки для изменений.', {
      code: 'validation_error',
      status: 400,
    });
  }

  const name = assertNonEmptyString(payload?.name, 'name', 200);
  let slugCandidate =
    payload?.slug != null && String(payload.slug).trim() !== ''
      ? String(payload.slug).trim().toLowerCase()
      : '';
  if (!slugCandidate) {
    slugCandidate = `salon-${Date.now()}`;
  }
  const slug = assertSlug(slugCandidate);

  const row = {
    user_id: uid,
    name,
    slug,
    description: optionalString(payload?.description, 'description', 2000) ?? '',
    address: optionalString(payload?.address, 'address', 500) ?? '',
    phone: payload?.phone ? assertPhone(payload.phone, 'phone') : '+7 000 000-00-00',
    email: optionalEmail(payload?.email, 'email'),
    hours: optionalString(payload?.hours, 'hours', 500) ?? 'Пн–Вс: 09:00–21:00',
    timezone: optionalString(payload?.timezone, 'timezone', 100) ?? 'Europe/Moscow',
    plan: optionalString(payload?.plan, 'plan', 100) ?? 'Free',
    status: 'active',
  };

  const created = throwOnError(
    await supabase.from('businesses').insert(row).select().single()
  );
  if (created?.id != null) {
    cachedOwnerBusinessId = created.id;
    cachedOwnerBusinessUserId = uid;
  }
  return created;
}

export async function getOwnerBusinessId() {
  const biz = await getBusiness();
  if (!biz?.id) {
    throw new ApiError('Сначала создайте профиль салона', { code: 'no_business', status: 400 });
  }
  return biz.id;
}
