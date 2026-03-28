import { throwOnError } from './helpers.js';
import { supabase } from './supabase.js';
import { requireSession } from './auth.js';
import { getOwnerBusinessId } from './business.js';
import { ApiError } from './errors.js';
import { requireRowInBusiness } from './access.js';
import {
  assertId,
  assertNonEmptyString,
  assertPhone,
  assertNonNegativeNumber,
  assertTagsArray,
  optionalEmail,
  optionalString,
} from './validation.js';

export async function getClients() {
  const bid = await getOwnerBusinessId();
  return throwOnError(
    await supabase.from('clients').select('*').eq('business_id', bid).order('name')
  );
}

export async function getClientById(id) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  return throwOnError(
    await supabase.from('clients').select('*').eq('id', id).eq('business_id', bid).single()
  );
}

export async function createClient(data) {
  await requireSession();
  const bid = await getOwnerBusinessId();
  if (data?.business_id != null && Number(data.business_id) !== bid) {
    throw new ApiError('Нельзя создавать клиента для чужого салона', {
      field: 'business_id',
      code: 'forbidden',
      status: 403,
    });
  }
  const visits = data?.total_visits ?? 0;
  const spent = data?.total_spent ?? 0;
  const insertData = {
    business_id: bid,
    name: assertNonEmptyString(data?.name, 'name', 200),
    phone: assertPhone(data?.phone, 'phone'),
    email: optionalEmail(data?.email, 'email'),
    notes: optionalString(data?.notes, 'notes', 5000),
    total_visits: assertNonNegativeNumber(visits, 'total_visits'),
    total_spent: assertNonNegativeNumber(spent, 'total_spent'),
    tags: assertTagsArray(data?.tags, 'tags'),
  };
  return throwOnError(
    await supabase.from('clients').insert(insertData).select().single()
  );
}

export async function updateClient(id, updates) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('clients', id, bid, 'Клиент');

  const safe = {};
  if (updates.name !== undefined) safe.name = assertNonEmptyString(updates.name, 'name', 200);
  if (updates.phone !== undefined) safe.phone = assertPhone(updates.phone, 'phone');
  if (updates.email !== undefined) safe.email = optionalEmail(updates.email, 'email');
  if (updates.notes !== undefined) safe.notes = optionalString(updates.notes, 'notes', 5000);
  if (updates.total_visits !== undefined) {
    safe.total_visits = assertNonNegativeNumber(updates.total_visits, 'total_visits');
  }
  if (updates.total_spent !== undefined) {
    safe.total_spent = assertNonNegativeNumber(updates.total_spent, 'total_spent');
  }
  if (updates.tags !== undefined) safe.tags = assertTagsArray(updates.tags, 'tags');

  if (Object.keys(safe).length === 0) {
    throw new ApiError('Нет полей для обновления', { code: 'validation_error', status: 400 });
  }

  return throwOnError(
    await supabase.from('clients').update(safe).eq('id', id).eq('business_id', bid).select().single()
  );
}

export async function deleteClient(id) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('clients', id, bid, 'Клиент');
  return throwOnError(
    await supabase.from('clients').delete().eq('id', id).eq('business_id', bid)
  );
}
