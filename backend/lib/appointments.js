import { throwOnError } from './helpers';
import { supabase } from './supabase';

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

export async function updateAppointment(id, updates) {
  return throwOnError(
    await supabase.from('appointments').update(updates).eq('id', id).select().single()
  );
}

const APPOINTMENT_COLS = ['client_name', 'client_phone', 'service_id', 'staff_id', 'date', 'time', 'duration', 'price', 'status', 'notes', 'business_id', 'service', 'staff_name'];

export async function createAppointment(data) {
  const insertData = {};
  for (const k of APPOINTMENT_COLS) {
    if (data[k] !== undefined) insertData[k] = data[k];
  }
  let result = await supabase.from('appointments').insert(insertData).select().single();
  while (result.error) {
    const msg = result.error.message || '';
    const bad = msg.match(/'([a-z_]+)'/);
    const col = bad ? bad[1] : null;
    if (!col || !(col in insertData)) break;
    delete insertData[col];
    result = await supabase.from('appointments').insert(insertData).select().single();
  }
  return throwOnError(result);
}

export async function deleteAppointment(id) {
  return throwOnError(
    await supabase.from('appointments').delete().eq('id', id)
  );
}
