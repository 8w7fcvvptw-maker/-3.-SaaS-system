import { throwOnError } from './helpers';
import { supabase } from './supabase';

/** Вложенный select: услуга, мастер, клиент (нужны FK в Supabase; иначе откат на '*'). */
const APPOINTMENT_REL_SELECT = `
  *,
  services ( id, name ),
  staff ( id, name ),
  clients ( id, name, phone, email )
`;

function isMissingRelationshipError(err) {
  const m = err?.message ?? '';
  return (
    m.includes('Could not find a relationship') ||
    m.includes('schema cache') ||
    err?.code === 'PGRST200'
  );
}

async function withRelFallback(run) {
  let res = await run(APPOINTMENT_REL_SELECT);
  if (!res.error) return res;
  if (isMissingRelationshipError(res.error)) {
    res = await run('*');
  }
  return res;
}

/** Найти или создать клиента по business_id + телефону для client_id в записи. */
async function resolveClientId({ business_id, client_phone, client_name, client_email }) {
  if (!business_id || !client_phone) return null;

  const found = await supabase
    .from('clients')
    .select('id')
    .eq('business_id', business_id)
    .eq('phone', client_phone)
    .limit(1);

  if (!found.error && Array.isArray(found.data) && found.data[0]?.id != null) {
    return found.data[0].id;
  }

  const insertData = {
    business_id,
    name: client_name || 'Клиент',
    phone: client_phone,
    email: client_email || null,
    total_visits: 0,
    total_spent: 0,
    tags: [],
    notes: null,
  };

  let created = await supabase.from('clients').insert(insertData).select('id').single();
  if (created.error) {
    created = await supabase
      .from('clients')
      .insert({
        business_id,
        name: insertData.name,
        phone: insertData.phone,
        email: insertData.email,
      })
      .select('id')
      .single();
  }

  if (created.error) return null;
  return created.data?.id ?? null;
}

/** Плоская строка для UI (service, staff_name, поля клиента из join или колонок). */
export function mapAppointmentRow(row) {
  if (!row || typeof row !== 'object') return row;
  const svc = row.services;
  const stf = row.staff;
  const cli = row.clients;
  const { services: _s, staff: _st, clients: _c, ...rest } = row;

  const serviceName =
    svc && typeof svc === 'object' && svc.name != null ? svc.name : rest.service ?? null;
  const staffName =
    stf && typeof stf === 'object' && stf.name != null ? stf.name : rest.staff_name ?? null;
  const clientName =
    cli && typeof cli === 'object' && cli.name != null ? cli.name : rest.client_name ?? null;
  const clientPhone =
    cli && typeof cli === 'object' && cli.phone != null ? cli.phone : rest.client_phone ?? null;
  const clientEmail =
    cli && typeof cli === 'object' && cli.email != null ? cli.email : rest.client_email ?? null;

  return {
    ...rest,
    service: serviceName,
    staff_name: staffName,
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
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

/** Сначала по client_id, иначе по имени (старые данные). */
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

  if (insertData.client_id == null) {
    try {
      const cid = await resolveClientId(insertData);
      if (cid != null) insertData.client_id = cid;
    } catch {
      // запись возможна и без client_id
    }
  }

  const res = await withRelFallback((sel) =>
    supabase.from('appointments').insert(insertData).select(sel).single()
  );
  return mapAppointmentRow(throwOnError(res));
}

export async function deleteAppointment(id) {
  return throwOnError(await supabase.from('appointments').delete().eq('id', id));
}
