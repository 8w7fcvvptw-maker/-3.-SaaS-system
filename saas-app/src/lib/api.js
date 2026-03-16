// ============================================
// API — все запросы к Supabase
// Таблицы: businesses, services, staff, appointments, clients,
//           time_slots, admin_businesses, revenue_data
// ============================================

import { supabase } from './supabase';

// ── helpers ──────────────────────────────────────────────────────
function throwOnError({ data, error }) {
  if (error) throw error;
  return data;
}

// ── Business ─────────────────────────────────────────────────────

/** Получить первый бизнес из таблицы (для демо) */
export async function getBusiness() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Обновить данные бизнеса */
export async function updateBusiness(id, updates) {
  return throwOnError(
    await supabase.from('businesses').update(updates).eq('id', id).select().single()
  );
}

// ── Services ─────────────────────────────────────────────────────

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

// ── Staff ────────────────────────────────────────────────────────

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

// ── Appointments ─────────────────────────────────────────────────

export async function getAppointments() {
  return throwOnError(
    await supabase.from('appointments').select('*').order('date').order('time')
  );
}

export async function getAppointmentsByDate(date) {
  return throwOnError(
    await supabase.from('appointments').select('*')
      .eq('date', date)
      .order('time')
  );
}

export async function getAppointmentById(id) {
  return throwOnError(
    await supabase.from('appointments').select('*').eq('id', id).single()
  );
}

export async function getAppointmentsByStaff(staffId) {
  return throwOnError(
    await supabase.from('appointments').select('*')
      .eq('staff_id', staffId)
      .order('date').order('time')
  );
}

export async function getAppointmentsByClient(clientName) {
  return throwOnError(
    await supabase.from('appointments').select('*')
      .eq('client_name', clientName)
      .order('date').order('time')
  );
}

export async function updateAppointmentStatus(id, status) {
  return throwOnError(
    await supabase.from('appointments').update({ status }).eq('id', id).select().single()
  );
}

export async function createAppointment(data) {
  return throwOnError(
    await supabase.from('appointments').insert(data).select().single()
  );
}

// ── Clients ──────────────────────────────────────────────────────

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

// ── Time Slots ───────────────────────────────────────────────────

/** Получить все временные слоты; если таблицы нет — вернуть дефолтные */
export async function getTimeSlots() {
  const { data, error } = await supabase.from('time_slots').select('slot').order('slot');
  if (error) {
    // Если таблицы нет — отдаём дефолтные полуторачасовые слоты
    return [
      "09:00","09:30","10:00","10:30","11:00","11:30",
      "12:00","12:30","13:00","13:30","14:00","14:30",
      "15:00","15:30","16:00","16:30","17:00","17:30",
      "18:00","18:30","19:00","19:30",
    ];
  }
  return data.map(r => r.slot);
}

/** Занятые слоты на дату + мастера */
export async function getBusySlots(date, staffId) {
  const query = supabase.from('appointments')
    .select('time')
    .eq('date', date)
    .not('status', 'eq', 'cancelled');
  if (staffId) query.eq('staff_id', staffId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(r => r.time);
}

// ── Admin ────────────────────────────────────────────────────────

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
