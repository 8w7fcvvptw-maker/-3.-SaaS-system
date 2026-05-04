import { supabase } from './supabase.js';
import { getOwnerBusinessId } from './business.js';
import { ApiError } from './errors.js';
import { assertDateIso, assertId, assertSlug } from './validation.js';

const DEFAULT_SLOTS = Array.from({ length: 49 }, (_, i) => {
  const h = 9 + Math.floor((i * 15) / 60);
  const m = (i * 15) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

export async function getTimeSlots() {
  const { data, error } = await supabase.from('time_slots').select('slot').order('slot');
  if (error) return DEFAULT_SLOTS;
  const slots = (data ?? []).map((r) => r.slot);
  return slots.length > 0 ? slots : DEFAULT_SLOTS;
}

/**
 * Занятые слоты на дату (и опционально мастера).
 * @param {string} date — YYYY-MM-DD
 * @param {number|null|undefined} staffId
 * @param {number|null|undefined} businessId
 * @param {string|null|undefined} publicSlug — для гостя: RPC get_public_busy_slot_times_v2
 * @param {{ serviceId?: number|null, duration?: number|null }|null|undefined} options
 */
export async function getBusySlots(date, staffId, businessId, publicSlug = null, options = null) {
  if (!date) return [];
  assertDateIso(date, 'date');
  const duration = Math.max(1, Math.min(24 * 60, Number(options?.duration ?? 30) || 30));
  const serviceId =
    options?.serviceId == null || options?.serviceId === ''
      ? null
      : assertId(Number(options.serviceId), 'service_id');

  if (businessId != null) {
    const bid = assertId(Number(businessId), 'business_id');
    if (publicSlug != null && String(publicSlug).trim() !== '') {
      const s = assertSlug(String(publicSlug).trim().toLowerCase(), 'slug');
      const { data, error } = await supabase.rpc('get_public_busy_slot_times_v2', {
        p_slug: s,
        p_date: date,
        p_staff_id: staffId != null ? assertId(Number(staffId), 'staff_id') : null,
        p_service_id: serviceId,
        p_duration: duration,
      });
      if (!error && data != null) {
        return data.map((r) => r.slot_time ?? r.time).filter(Boolean);
      }
      const oldFn = await supabase.rpc('get_public_busy_slot_times', {
        p_slug: s,
        p_date: date,
        p_staff_id: staffId != null ? assertId(Number(staffId), 'staff_id') : null,
      });
      if (!oldFn.error && oldFn.data != null) {
        return oldFn.data.map((r) => r.slot_time ?? r.time).filter(Boolean);
      }
      return [];
    }
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) return [];
    const ownerBid = await getOwnerBusinessId();
    if (bid !== ownerBid) {
      throw new ApiError('Нет доступа к указанному салону', {
        field: 'business_id',
        code: 'forbidden',
        status: 403,
      });
    }
    const { data, error } = await supabase.rpc('get_busy_slot_times_v2', {
      p_business_id: bid,
      p_date: date,
      p_staff_id: staffId != null ? assertId(Number(staffId), 'staff_id') : null,
      p_service_id: serviceId,
      p_duration: duration,
    });
    if (!error && data != null) {
      return data.map((r) => r.slot_time ?? r.time).filter(Boolean);
    }
    const oldFn = await supabase.rpc('get_busy_slot_times', {
      p_business_id: bid,
      p_date: date,
      p_staff_id: staffId != null ? assertId(Number(staffId), 'staff_id') : null,
    });
    if (!oldFn.error && oldFn.data != null) {
      return oldFn.data.map((r) => r.slot_time ?? r.time).filter(Boolean);
    }
    const query = supabase
      .from('appointments')
      .select('time')
      .eq('business_id', bid)
      .eq('date', date)
      .not('status', 'eq', 'cancelled');
    const q = staffId != null ? query.eq('staff_id', assertId(Number(staffId), 'staff_id')) : query;
    const { data: rows, error: e2 } = await q;
    if (e2) return [];
    return (rows ?? []).map((r) => r.time);
  }

  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) return [];

  const query = supabase
    .from('appointments')
    .select('time')
    .eq('date', date)
    .not('status', 'eq', 'cancelled');
  const q = staffId != null ? query.eq('staff_id', assertId(Number(staffId), 'staff_id')) : query;
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map((r) => r.time);
}
