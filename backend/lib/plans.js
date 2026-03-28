import { throwOnError } from './helpers.js';
import { supabase } from './supabase.js';
import { ApiError } from './errors.js';
import { requireSession } from './auth.js';
import { assertUuid } from './validation.js';

export async function getPlans() {
  await requireSession();
  return throwOnError(await supabase.from('plans').select('*').order('sort_order'));
}

export async function getPlanById(id) {
  await requireSession();
  const pid = assertUuid(id, 'id');
  return throwOnError(await supabase.from('plans').select('*').eq('id', pid).single());
}

export async function updatePlan(_id, _updates) {
  throw new ApiError('Изменение тарифов недоступно в этой версии приложения', {
    code: 'forbidden',
    status: 403,
  });
}
