import { throwOnError } from './helpers';
import { supabase } from './supabase';

export async function getPlans() {
  return throwOnError(
    await supabase.from('plans').select('*').order('sort_order')
  );
}

export async function getPlanById(id) {
  return throwOnError(
    await supabase.from('plans').select('*').eq('id', id).single()
  );
}

export async function updatePlan(id, updates) {
  const safe = { ...updates };
  if (Array.isArray(safe.features)) safe.features = safe.features;
  if (Array.isArray(safe.not_included)) safe.not_included = safe.not_included;
  return throwOnError(
    await supabase.from('plans').update(safe).eq('id', id).select().single()
  );
}
