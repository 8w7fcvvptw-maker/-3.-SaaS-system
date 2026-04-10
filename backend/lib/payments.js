import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { requireUser } from './auth.js';
import { throwOnError } from './helpers.js';

/** Получить список платежей текущего пользователя */
export async function getMyPayments() {
  const user = await requireUser();
  return throwOnError(
    await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
  );
}
