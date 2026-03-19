import { throwOnError } from './helpers';
import { supabase } from './supabase';

export async function getServices() {
  return throwOnError(
    await supabase.from('services').select('*').order('name')
  );
}

export async function getActiveServices() {
  return throwOnError(
    await supabase.from('services').select('*').eq('active', true).order('name')
  );
}

export async function getServiceById(id) {
  return throwOnError(
    await supabase.from('services').select('*').eq('id', id).single()
  );
}

export async function updateService(id, updates) {
  return throwOnError(
    await supabase.from('services').update(updates).eq('id', id).select().single()
  );
}

export async function createService(data) {
  const { id: _id, ...insertData } = data;
  return throwOnError(
    await supabase.from('services').insert(insertData).select().single()
  );
}

export async function deleteService(id) {
  return throwOnError(
    await supabase.from('services').delete().eq('id', id)
  );
}
