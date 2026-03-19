import { supabase } from './supabase';
import { throwOnError } from './helpers';

/**
 * Получить бизнес (первый из таблицы).
 * Если в таблице businesses есть колонка slug — можно раскомментировать фильтр.
 */
export async function getBusiness(slug) {
  let query = supabase.from('businesses').select('*').limit(1);
  // Колонка slug может отсутствовать в схеме Supabase:
  // if (slug) query = query.eq('slug', slug);
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

/** Обновить данные бизнеса */
export async function updateBusiness(id, updates) {
  return throwOnError(
    await supabase.from('businesses').update(updates).eq('id', id).select().single()
  );
}
