import { throwOnError } from './helpers';
import { supabase } from './supabase';

export async function getStaff() {
  return throwOnError(
    await supabase.from('staff').select('*').order('name')
  );
}

export async function getStaffById(id) {
  return throwOnError(
    await supabase.from('staff').select('*').eq('id', id).single()
  );
}

export async function createStaff(data) {
  const { id: _id, services, service_ids, ...rest } = data;
  const svcIds = services ?? service_ids ?? [];
  let insertData = { ...rest, service_ids: svcIds };

  let result = await supabase.from('staff').insert(insertData).select().single();
  if (result.error && /service_ids|services/.test(result.error.message)) {
    insertData = { ...rest };
    result = await supabase.from('staff').insert(insertData).select().single();
  }
  return throwOnError(result);
}

export async function updateStaff(id, updates) {
  return throwOnError(
    await supabase.from('staff').update(updates).eq('id', id).select().single()
  );
}

export async function deleteStaff(id) {
  return throwOnError(
    await supabase.from('staff').delete().eq('id', id)
  );
}
