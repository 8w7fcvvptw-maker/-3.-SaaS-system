import { throwOnError } from './helpers';
import { supabase } from './supabase';

export async function getClients() {
  return throwOnError(
    await supabase.from('clients').select('*').order('name')
  );
}

export async function getClientById(id) {
  return throwOnError(
    await supabase.from('clients').select('*').eq('id', id).single()
  );
}

export async function createClient(data) {
  const { id: _id, ...insertData } = data;
  return throwOnError(
    await supabase.from('clients').insert(insertData).select().single()
  );
}

export async function updateClient(id, updates) {
  return throwOnError(
    await supabase.from('clients').update(updates).eq('id', id).select().single()
  );
}

export async function deleteClient(id) {
  return throwOnError(
    await supabase.from('clients').delete().eq('id', id)
  );
}
