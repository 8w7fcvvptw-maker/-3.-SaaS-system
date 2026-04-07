import { throwOnError } from './helpers.js';
import { supabase } from './supabase.js';
import { requireSession } from './auth.js';
import { getOwnerBusinessId } from './business.js';
import { ApiError } from './errors.js';
import { requireRowInBusiness } from './access.js';
import {
  assertId,
  assertNonEmptyString,
  optionalString,
  assertPhone,
  assertRatingOptional,
} from './validation.js';

function assertServiceIdsArray(value, field = 'service_ids') {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new ApiError(`Поле «${field}» должно быть массивом`, { field, code: 'validation_error', status: 400 });
  }
  if (value.length > 200) {
    throw new ApiError(`Поле «${field}»: слишком много элементов`, { field, code: 'validation_error', status: 400 });
  }
  return value.map((x) => assertId(Number(x), field));
}

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

async function resolveBusinessIdForRead(explicitBusinessId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    if (explicitBusinessId != null && String(explicitBusinessId).trim() !== '') {
      return assertId(Number(explicitBusinessId), 'business_id');
    }
    throw new ApiError('Не указан салон', { field: 'business_id', code: 'validation_error', status: 400 });
  }
  try {
    return await resolveBusinessId(explicitBusinessId);
  } catch (e) {
    if (e?.code === 'no_business' && explicitBusinessId != null && String(explicitBusinessId).trim() !== '') {
      return assertId(Number(explicitBusinessId), 'business_id');
    }
    throw e;
  }
}

export async function getStaff(businessId) {
  const bid = await resolveBusinessIdForRead(businessId);
  return throwOnError(
    await supabase.from('staff').select('*').eq('business_id', bid).order('name')
  );
}

export async function getStaffById(id) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  return throwOnError(
    await supabase.from('staff').select('*').eq('id', id).eq('business_id', bid).single()
  );
}

export async function createStaff(data) {
  await requireSession();
  const bid = await getOwnerBusinessId();
  if (data?.business_id != null && Number(data.business_id) !== bid) {
    throw new ApiError('Нельзя создавать сотрудника для чужого салона', {
      field: 'business_id',
      code: 'forbidden',
      status: 403,
    });
  }
  const svcIds = assertServiceIdsArray(data?.services ?? data?.service_ids, 'service_ids');
  const ratingVal = assertRatingOptional(data?.rating, 'rating');
  let insertData = {
    business_id: bid,
    name: assertNonEmptyString(data?.name, 'name', 200),
    role: optionalString(data?.role, 'role', 120) ?? 'Мастер',
    phone: data?.phone ? assertPhone(data.phone, 'phone') : null,
    working_hours: optionalString(data?.working_hours, 'working_hours', 500),
    specialization: optionalString(data?.specialization, 'specialization', 500),
    service_ids: svcIds,
  };
  if (ratingVal !== undefined) insertData.rating = ratingVal;

  let result = await supabase.from('staff').insert(insertData).select().single();
  if (result.error && /service_ids|services/.test(result.error.message)) {
    const { service_ids: _si, ...restOnly } = insertData;
    result = await supabase.from('staff').insert(restOnly).select().single();
  }
  return throwOnError(result);
}

export async function updateStaff(id, updates) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('staff', id, bid, 'Сотрудник');

  const safe = {};
  if (updates.name !== undefined) safe.name = assertNonEmptyString(updates.name, 'name', 200);
  if (updates.role !== undefined) safe.role = optionalString(updates.role, 'role', 120);
  if (updates.phone !== undefined) {
    if (updates.phone == null || !String(updates.phone).trim()) {
      safe.phone = null;
    } else {
      safe.phone = assertPhone(updates.phone, 'phone');
    }
  }
  if (updates.working_hours !== undefined) {
    safe.working_hours = optionalString(updates.working_hours, 'working_hours', 500);
  }
  if (updates.specialization !== undefined) {
    safe.specialization = optionalString(updates.specialization, 'specialization', 500);
  }
  if (updates.rating !== undefined) {
    const r = assertRatingOptional(updates.rating, 'rating');
    if (r !== undefined) safe.rating = r;
  }
  if (updates.service_ids !== undefined || updates.services !== undefined) {
    safe.service_ids = assertServiceIdsArray(updates.service_ids ?? updates.services, 'service_ids');
  }

  if (Object.keys(safe).length === 0) {
    throw new ApiError('Нет полей для обновления', { code: 'validation_error', status: 400 });
  }

  let result = await supabase.from('staff').update(safe).eq('id', id).eq('business_id', bid).select().single();
  if (result.error && /service_ids|services/.test(result.error.message)) {
    const { service_ids: _si, ...restOnly } = safe;
    result = await supabase.from('staff').update(restOnly).eq('id', id).eq('business_id', bid).select().single();
  }
  return throwOnError(result);
}

export async function deleteStaff(id) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('staff', id, bid, 'Сотрудник');
  return throwOnError(
    await supabase.from('staff').delete().eq('id', id).eq('business_id', bid)
  );
}
