import { supabase } from './supabase';

const DEFAULT_SLOTS = Array.from({ length: 49 }, (_, i) => {
  const h = 9 + Math.floor((i * 15) / 60);
  const m = (i * 15) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

/** Получить все временные слоты; если таблицы нет или пуста — вернуть дефолтные */
export async function getTimeSlots() {
  const { data, error } = await supabase.from('time_slots').select('slot').order('slot');
  if (error) return DEFAULT_SLOTS;
  const slots = (data ?? []).map(r => r.slot);
  return slots.length > 0 ? slots : DEFAULT_SLOTS;
}

/** Занятые слоты на дату + мастера */
export async function getBusySlots(date, staffId) {
  if (!date) return [];
  const query = supabase.from('appointments')
    .select('time')
    .eq('date', date)
    .not('status', 'eq', 'cancelled');
  const q = staffId ? query.eq('staff_id', staffId) : query;
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => r.time);
}
