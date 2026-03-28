import { throwOnError } from './helpers';
import { supabase } from './supabase';

/** Вложенный select: имена услуги и мастера из связанных таблиц (нужны FK в Supabase). */
const APPOINTMENT_REL_SELECT = `
  *,
  services ( id, name ),
  staff ( id, name )
`;

function isMissingRelationshipError(err) {
  const m = err?.message ?? '';
  return (
    m.includes('Could not find a relationship') ||
    m.includes('schema cache') ||
    err?.code === 'PGRST200'
  );
}

/**
 * Выполняет select с вложенными таблицами; при отсутствии FK в проекте — повтор с '*'.
 * @param {(sel: string) => Promise<{ data: unknown; error: unknown }>} run
 */
async function withRelFallback(run) {
  let res = await run(APPOINTMENT_REL_SELECT);
  if (!res.error) return res;
  if (isMissingRelationshipError(res.error)) {
    res = await run('*');
  }
  return res;
}

/** Приводит строку PostgREST к плоскому виду для UI (service, staff_name). */
export function mapAppointmentRow(row) {
  if (!row || typeof row !== 'object') return row;
  const svc = row.services;
  const stf = row.staff;
  const { services: _s, staff: _st, ...rest } = row;
  const serviceName =
    svc && typeof svc === 'object' && svc.name != null ? svc.name : rest.service ?? null;
  const staffName =
    stf && typeof stf === 'object' && stf.name != null ? stf.name : rest.staff_name ?? null;
  return {
    ...rest,
    service: serviceName,
    staff_name: staffName,
  };
}

function mapAppointmentRows(data) {
  return (data ?? []).map(mapAppointmentRow);
}

export async function getAppointments() {
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').select(sel).order('date').order('time')
  );
  return mapAppointmentRows(throwOnError(res));
}

export async function getAppointmentsByDate(date) {
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').select(sel).eq('date', date).order('time')
  );
  return mapAppointmentRows(throwOnError(res));
}

export async function getAppointmentById(id) {
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').select(sel).eq('id', id).single()
  );
  return mapAppointmentRow(throwOnError(res));
}

export async function getAppointmentsByStaff(staffId) {
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').select(sel).eq('staff_id', staffId).order('date').order('time')
  );
  return mapAppointmentRows(throwOnError(res));
}

export async function getAppointmentsByClient(clientName) {
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').select(sel).eq('client_name', clientName).order('date').order('time')
  );
  return mapAppointmentRows(throwOnError(res));
}

/** Записи клиента: сначала по client_id, иначе по имени (старые данные). */
export async function getAppointmentsForClient(clientId, clientName) {
  const r1 = await withRelFallback((sel) =>
    supabase.from('appointments').select(sel).eq('client_id', clientId).order('date').order('time')
  );
  if (r1.error) throw r1.error;
  if (r1.data?.length) return mapAppointmentRows(r1.data);
  const name = (clientName ?? '').trim();
  if (!name) return [];
  const r2 = await withRelFallback((sel) =>
    supabase.from('appointments').select(sel).eq('client_name', name).order('date').order('time')
  );
  return mapAppointmentRows(throwOnError(r2));
}

export async function updateAppointmentStatus(id, status) {
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').update({ status }).eq('id', id).select(sel).single()
  );
  return mapAppointmentRow(throwOnError(res));
}

export async function updateAppointment(id, updates) {
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').update(updates).eq('id', id).select(sel).single()
  );
  return mapAppointmentRow(throwOnError(res));
}

const APPOINTMENT_INSERT_COLS = [
  'client_name',
  'client_phone',
  'client_email',
  'client_id',
  'service_id',
  'staff_id',
  'date',
  'time',
  'duration',
  'price',
  'status',
  'notes',
  'business_id',
];

export async function createAppointment(data) {
  const insertData = {};
  for (const k of APPOINTMENT_INSERT_COLS) {
    if (data[k] !== undefined) insertData[k] = data[k];
  }
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').insert(insertData).select(sel).single()
  );
  return mapAppointmentRow(throwOnError(res));
}

export async function deleteAppointment(id) {
  return throwOnError(await supabase.from('appointments').delete().eq('id', id));
}
