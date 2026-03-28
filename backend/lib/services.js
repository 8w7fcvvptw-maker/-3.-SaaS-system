import { throwOnError } from './helpers.js';
import { supabase } from './supabase.js';
import { requireSession } from './auth.js';
import { getOwnerBusinessId } from './business.js';
import { ApiError } from './errors.js';
import { requireRowInBusiness } from './access.js';
import {
  assertId,
  assertNonEmptyString,
  assertPositiveInt,
  assertNonNegativeNumber,
  optionalString,
} from './validation.js';

async function resolveBusinessId(explicitBusinessId) {
  const ownerBid = await getOwnerBusinessId();
  if (explicitBusinessId != null && String(explicitBusinessId).trim() !== '') {
    const n = assertId(Number(explicitBusinessId), 'business_id');
    if (n !== ownerBid) {
      throw new ApiError('Нет доступа к указанному салону', {
        field: 'business_id',
        code: 'forbidden',
        status: 403,
      });
    }
    return n;
  }
  return ownerBid;
}

/** @param {number|undefined} businessId — только id своего салона */
export async function getServices(businessId) {
  const bid = await resolveBusinessId(businessId);
  return throwOnError(
    await supabase.from('services').select('*').eq('business_id', bid).order('name')
  );
}

export async function getActiveServices(businessId) {
  const bid = await resolveBusinessId(businessId);
  return throwOnError(
    await supabase.from('services').select('*').eq('business_id', bid).eq('active', true).order('name')
  );
}

export async function getServiceById(id) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  return throwOnError(
    await supabase.from('services').select('*').eq('id', id).eq('business_id', bid).single()
  );
}

export async function updateService(id, updates) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('services', id, bid, 'Услуга');

  const safe = {};
  if (updates.name !== undefined) safe.name = assertNonEmptyString(updates.name, 'name', 200);
  if (updates.description !== undefined) safe.description = optionalString(updates.description, 'description', 2000);
  if (updates.duration !== undefined) safe.duration = assertPositiveInt(updates.duration, 'duration');
  if (updates.price !== undefined) safe.price = assertNonNegativeNumber(updates.price, 'price');
  if (updates.category !== undefined) safe.category = optionalString(updates.category, 'category', 100);
  if (updates.color !== undefined) safe.color = optionalString(updates.color, 'color', 32);
  if (updates.active !== undefined) safe.active = Boolean(updates.active);
  if (Object.keys(safe).length === 0) {
    throw new ApiError('Нет полей для обновления', { code: 'validation_error', status: 400 });
  }
  return throwOnError(
    await supabase.from('services').update(safe).eq('id', id).eq('business_id', bid).select().single()
  );
}

export async function createService(data) {
  await requireSession();
  const bid = await getOwnerBusinessId();
  if (data?.business_id != null && Number(data.business_id) !== bid) {
    throw new ApiError('Нельзя создавать услугу для чужого салона', {
      field: 'business_id',
      code: 'forbidden',
      status: 403,
    });
  }
  const insertData = {
    business_id: bid,
    name: assertNonEmptyString(data?.name, 'name', 200),
    duration: assertPositiveInt(data?.duration ?? 30, 'duration'),
    price: assertNonNegativeNumber(data?.price ?? 0, 'price'),
    description: optionalString(data?.description, 'description', 2000),
    category: optionalString(data?.category, 'category', 100),
    color: optionalString(data?.color, 'color', 32) ?? '#6366f1',
    active: data?.active !== false,
  };
  return throwOnError(
    await supabase.from('services').insert(insertData).select().single()
  );
}

export async function deleteService(id) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('services', id, bid, 'Услуга');
  return throwOnError(
    await supabase.from('services').delete().eq('id', id).eq('business_id', bid)
  );
}
