import { throwOnError } from './helpers';
import { supabase } from './supabase';

async function resolveClientId({ business_id, client_phone, client_name, client_email }) {
  if (!business_id || !client_phone) return null;

  // 1) Try find existing client by (business_id, phone)
  const found = await supabase
    .from('clients')
    .select('id')
    .eq('business_id', business_id)
    .eq('phone', client_phone)
    .limit(1);

  if (!found.error && Array.isArray(found.data) && found.data[0]?.id != null) {
    return found.data[0].id;
  }

  // 2) Create client if not found (safe defaults; may fail if schema differs)
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
    // If some columns are missing in user's schema, try minimal insert.
    created = await supabase
      .from('clients')
      .insert({ business_id, name: insertData.name, phone: insertData.phone, email: insertData.email })
      .select('id')
      .single();
  }

  if (created.error) return null;
  return created.data?.id ?? null;
}

function normalizeAppointment(row) {
  if (!row || typeof row !== 'object') return row;

  const serviceName =
    (typeof row.service === 'string' && row.service) ||
    row.services?.name ||
    row.service_name ||
    '';

  const staffName =
    (typeof row.staff_name === 'string' && row.staff_name) ||
    row.staff?.name ||
    row.staff_name_full ||
    '';

  const clientName =
    row.client_name ||
    row.clients?.name ||
    '';

  const clientPhone =
    row.client_phone ||
    row.clients?.phone ||
    '';

  const clientEmail =
    row.client_email ||
    row.clients?.email ||
    '';

  // Возвращаем плоскую структуру, которую уже ожидает UI.
  // При этом сохраняем вложенные объекты (services/staff/clients) если они пришли.
  return {
    ...row,
    service: serviceName,
    staff_name: staffName,
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
  };
}

async function safeSelectAppointments(apply = (q) => q) {
  // В Supabase фильтры (.eq/.order/...) живут на билдере после .select().
  // Поэтому строим запрос как: from() -> select() -> apply(filters).
  const base = supabase.from('appointments');

  const withJoins = apply(
    base.select(
      [
        '*',
        'services(name,duration,price)',
        'staff(name)',
        'clients(id,name,phone,email)',
      ].join(',')
    )
  );

  const result = await withJoins;
  if (!result.error) return result;

  const fallback = await apply(base.select('*'));
  return fallback;
}

export async function getAppointments() {
  const result = await safeSelectAppointments((q) => q.order('date').order('time'));
  const data = throwOnError(result);
  return (data ?? []).map(normalizeAppointment);
}

export async function getAppointmentsByDate(date) {
  const result = await safeSelectAppointments((q) => q.eq('date', date).order('time'));
  const data = throwOnError(result);
  return (data ?? []).map(normalizeAppointment);
}

export async function getAppointmentById(id) {
  const result = await safeSelectAppointments((q) => q.eq('id', id));
  const data = throwOnError(result);
  const row = Array.isArray(data) ? (data[0] ?? null) : data;
  return normalizeAppointment(row);
}

export async function getAppointmentsByStaff(staffId) {
  const result = await safeSelectAppointments((q) =>
    q.eq('staff_id', staffId).order('date').order('time')
  );
  const data = throwOnError(result);
  return (data ?? []).map(normalizeAppointment);
}

export async function getAppointmentsByClient(client) {
  const isId = client != null && String(client).match(/^\d+$/);
  const result = await safeSelectAppointments((q) => {
    const filtered = isId ? q.eq('client_id', Number(client)) : q.eq('client_name', client);
    return filtered.order('date').order('time');
  });
  const data = throwOnError(result);
  return (data ?? []).map(normalizeAppointment);
}

export async function updateAppointmentStatus(id, status) {
  return throwOnError(
    await supabase.from('appointments').update({ status }).eq('id', id).select().single()
  );
}

export async function updateAppointment(id, updates) {
  const updated = throwOnError(
    await supabase.from('appointments').update(updates).eq('id', id).select().single()
  );
  return normalizeAppointment(updated);
}

const APPOINTMENT_COLS = [
  'client_id',
  'client_name',
  'client_phone',
  'client_email',
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
  for (const k of APPOINTMENT_COLS) {
    if (data[k] !== undefined) insertData[k] = data[k];
  }

  // Auto-link appointment to a client (if client_id column exists in DB).
  if (insertData.client_id == null) {
    try {
      const cid = await resolveClientId(insertData);
      if (cid != null) insertData.client_id = cid;
    } catch {
      // ignore — app still works without this linkage
    }
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
  const created = throwOnError(result);
  // Добираем связанные поля (если relationships уже настроены).
  try {
    return await getAppointmentById(created.id);
  } catch {
    return normalizeAppointment(created);
  }
}

export async function deleteAppointment(id) {
  return throwOnError(
    await supabase.from('appointments').delete().eq('id', id)
  );
}
