import { throwOnError } from './helpers';
import { supabase } from './supabase';

export async function getAdminBusinesses() {
  return throwOnError(
    await supabase.from('admin_businesses').select('*').order('id', { ascending: false })
  );
}

export async function getRevenueData() {
  return throwOnError(
    await supabase.from('revenue_data').select('*').order('id')
  );
}
