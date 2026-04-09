import { throwOnError } from './helpers.js';
import { supabase } from './supabase.js';
import { requireSession } from './auth.js';
import { getOwnerBusinessId } from './business.js';
import { ApiError } from './errors.js';
import { requireRowInBusiness, requireServiceInBusiness, requireStaffInBusiness, requireClientInBusiness } from './access.js';
import { requireActiveSubscription } from './roles.js';
import { checkAppointmentQuota } from './subscriptions.js';
import {
  assertId,
  assertDateIso,
  assertTimeSlot,
  assertPhone,
  assertNonEmptyString,
  assertAppointmentStatus,
  optionalEmail,
  optionalString,
  assertPositiveInt,
  assertNonNegativeNumber,
  assertSlug,
} from './validation.js';
import { notifyNewAppointmentCreated } from './telegram.js';

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

  const phoneNorm = assertPhone(client_phone, 'client_phone');
  const insertData = {
    business_id,
    name: client_name || 'Клиент',
    phone: phoneNorm,
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

async function scopedQuery(build) {
  const bid = await getOwnerBusinessId();
  return build(bid);
}

export async function getAppointments() {
  const res = await scopedQuery((bid) =>
    withRelFallback((sel) =>
      supabase.from('appointments').select(sel).eq('business_id', bid).order('date').order('time')
    )
  );
  return mapAppointmentRows(throwOnError(res));
}

export async function getAppointmentsByDate(date) {
  assertDateIso(date, 'date');
  const res = await scopedQuery((bid) =>
    withRelFallback((sel) =>
      supabase.from('appointments').select(sel).eq('business_id', bid).eq('date', date).order('time')
    )
  );
  return mapAppointmentRows(throwOnError(res));
}

export async function getAppointmentById(id) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  const res = await withRelFallback((sel) =>
    supabase.from('appointments').select(sel).eq('id', id).eq('business_id', bid).single()
  );
  return mapAppointmentRow(throwOnError(res));
}

export async function getAppointmentsByStaff(staffId) {
  assertId(staffId, 'staff_id');
  const res = await scopedQuery((bid) =>
    withRelFallback((sel) =>
      supabase
        .from('appointments')
        .select(sel)
        .eq('business_id', bid)
        .eq('staff_id', staffId)
        .order('date')
        .order('time')
    )
  );
  return mapAppointmentRows(throwOnError(res));
}

export async function getAppointmentsByClient(clientName) {
  const name = assertNonEmptyString(clientName, 'clientName', 200);
  const res = await scopedQuery((bid) =>
    withRelFallback((sel) =>
      supabase
        .from('appointments')
        .select(sel)
        .eq('business_id', bid)
        .eq('client_name', name)
        .order('date')
        .order('time')
    )
  );
  return mapAppointmentRows(throwOnError(res));
}

export async function getAppointmentsForClient(clientId, clientName) {
  await requireSession();
  assertId(clientId, 'client_id');
  const bid = await getOwnerBusinessId();
  const r1 = await withRelFallback((sel) =>
    supabase
      .from('appointments')
      .select(sel)
      .eq('business_id', bid)
      .eq('client_id', clientId)
      .order('date')
      .order('time')
  );
  if (r1.error) throwOnError({ data: null, error: r1.error });
  if (r1.data?.length) return mapAppointmentRows(r1.data);
  const n = (clientName ?? '').trim();
  if (!n) return [];
  const r2 = await withRelFallback((sel) =>
    supabase
      .from('appointments')
      .select(sel)
      .eq('business_id', bid)
      .eq('client_name', n)
      .order('date')
      .order('time')
  );
  return mapAppointmentRows(throwOnError(r2));
}

export async function updateAppointmentStatus(id, status) {
  await requireSession();
  await requireActiveSubscription();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('appointments', id, bid, 'Запись');
  const st = assertAppointmentStatus(status, 'status');
  const res = await withRelFallback((sel) =>
    supabase
      .from('appointments')
      .update({ status: st })
      .eq('id', id)
      .eq('business_id', bid)
      .select(sel)
      .single()
  );
  return mapAppointmentRow(throwOnError(res));
}

export async function updateAppointment(id, updates) {
  await requireSession();
  await requireActiveSubscription();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('appointments', id, bid, 'Запись');

  const safe = {};
  if (updates.status !== undefined) safe.status = assertAppointmentStatus(updates.status, 'status');
  if (updates.date !== undefined) safe.date = assertDateIso(updates.date, 'date');
  if (updates.time !== undefined) safe.time = assertTimeSlot(updates.time, 'time');
  if (updates.client_phone !== undefined && updates.client_phone != null && String(updates.client_phone).trim()) {
    safe.client_phone = assertPhone(updates.client_phone, 'client_phone');
  }
  if (updates.client_email !== undefined) safe.client_email = optionalEmail(updates.client_email, 'client_email');
  if (updates.notes !== undefined) safe.notes = optionalString(updates.notes, 'notes', 5000);
  if (updates.client_name !== undefined) {
    safe.client_name = assertNonEmptyString(updates.client_name, 'client_name', 200);
  }
  if (updates.service_id !== undefined) {
    safe.service_id = updates.service_id == null ? null : assertId(Number(updates.service_id), 'service_id');
    if (safe.service_id != null) await requireServiceInBusiness(safe.service_id, bid);
  }
  if (updates.staff_id !== undefined) {
    safe.staff_id = updates.staff_id == null ? null : assertId(Number(updates.staff_id), 'staff_id');
    if (safe.staff_id != null) await requireStaffInBusiness(safe.staff_id, bid);
  }
  if (updates.duration !== undefined) safe.duration = assertPositiveInt(updates.duration, 'duration');
  if (updates.price !== undefined) safe.price = assertNonNegativeNumber(updates.price, 'price');

  if (Object.keys(safe).length === 0) {
    throw new ApiError('Нет полей для обновления', { code: 'validation_error', status: 400 });
  }

  const res = await withRelFallback((sel) =>
    supabase.from('appointments').update(safe).eq('id', id).eq('business_id', bid).select(sel).single()
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

function pickNotes(value) {
  if (value === undefined) return undefined;
  return optionalString(value, 'notes', 5000);
}

export async function createAppointment(data) {
  await requireSession();
  await requireActiveSubscription();
  const ownerBid = await getOwnerBusinessId();
  await checkAppointmentQuota(ownerBid);

  const insertData = {};
  for (const k of APPOINTMENT_INSERT_COLS) {
    if (data[k] !== undefined) insertData[k] = data[k];
  }

  const rawBid = insertData.business_id ?? data.business_id ?? ownerBid;
  insertData.business_id = assertId(Number(rawBid), 'business_id');
  if (insertData.business_id !== ownerBid) {
    throw new ApiError('Нельзя создавать записи для чужого салона', {
      field: 'business_id',
      code: 'forbidden',
      status: 403,
    });
  }
  insertData.date = assertDateIso(insertData.date ?? data.date, 'date');
  insertData.time = assertTimeSlot(insertData.time ?? data.time, 'time');
  insertData.duration = assertPositiveInt(insertData.duration ?? data.duration ?? 30, 'duration');
  insertData.price = assertNonNegativeNumber(
    insertData.price ?? data.price ?? 0,
    'price'
  );
  insertData.status = insertData.status
    ? assertAppointmentStatus(insertData.status, 'status')
    : 'pending';

  if (!insertData.client_phone || !String(insertData.client_phone).trim()) {
    throw new ApiError('Укажите телефон', { field: 'client_phone', code: 'validation_error', status: 400 });
  }
  insertData.client_phone = assertPhone(insertData.client_phone, 'client_phone');
  if (insertData.client_email != null && String(insertData.client_email).trim()) {
    insertData.client_email = optionalEmail(insertData.client_email, 'client_email');
  }
  if (insertData.client_name == null || !String(insertData.client_name).trim()) {
    insertData.client_name = 'Клиент';
  } else {
    insertData.client_name = assertNonEmptyString(insertData.client_name, 'client_name', 200);
  }
  if (insertData.service_id != null) {
    insertData.service_id = assertId(Number(insertData.service_id), 'service_id');
    await requireServiceInBusiness(insertData.service_id, insertData.business_id);
  }
  if (insertData.staff_id != null) {
    insertData.staff_id = assertId(Number(insertData.staff_id), 'staff_id');
    await requireStaffInBusiness(insertData.staff_id, insertData.business_id);
  }
  if (insertData.client_id != null) {
    insertData.client_id = assertId(Number(insertData.client_id), 'client_id');
    await requireClientInBusiness(insertData.client_id, insertData.business_id);
  }

  if (insertData.client_id == null) {
    try {
      const cid = await resolveClientId(insertData);
      if (cid != null) insertData.client_id = cid;
    } catch {
      // запись возможна и без client_id
    }
  }

  if (insertData.notes !== undefined) {
    insertData.notes = pickNotes(insertData.notes);
  }

  const res = await withRelFallback((sel) =>
    supabase.from('appointments').insert(insertData).select(sel).single()
  );
  const created = mapAppointmentRow(throwOnError(res));
  await notifyNewAppointmentCreated(created);
  return created;
}

/** Публичная онлайн-запись (RPC `create_public_appointment`, миграция 005). */
export async function createPublicAppointment(payload) {
  const slug = assertSlug(String(payload?.slug ?? '').trim().toLowerCase(), 'slug');
  const client_name = assertNonEmptyString(
    payload?.client_name ?? payload?.clientName,
    'client_name',
    200
  );
  const client_phone = assertPhone(payload?.client_phone ?? payload?.clientPhone, 'client_phone');
  const client_email = optionalEmail(payload?.client_email ?? payload?.clientEmail, 'client_email');
  const service_id = payload?.service_id ?? payload?.service?.id;
  const staff_id = payload?.staff_id ?? payload?.staff?.id;
  const dateStr = assertDateIso(payload?.date, 'date');
  const timeStr = assertTimeSlot(payload?.time, 'time');
  const duration = assertPositiveInt(payload?.duration ?? 30, 'duration');
  const price = assertNonNegativeNumber(payload?.price ?? 0, 'price');
  const notes = optionalString(payload?.notes, 'notes', 5000);

  const { data: newId, error } = await supabase.rpc('create_public_appointment', {
    p_slug: slug,
    p_client_name: client_name,
    p_client_phone: client_phone,
    p_client_email: client_email,
    p_service_id: service_id == null ? null : assertId(Number(service_id), 'service_id'),
    p_staff_id: staff_id == null || staff_id === '' ? null : assertId(Number(staff_id), 'staff_id'),
    p_date: dateStr,
    p_time: timeStr,
    p_duration: duration,
    p_price: price,
    p_notes: notes,
  });

  if (error) {
    throw new ApiError(error.message || 'Не удалось создать запись', {
      code: 'validation_error',
      status: 400,
    });
  }

  const created = { id: newId, slug };
  await notifyNewAppointmentCreated(created);
  return created;
}

/** Удаление только в финальных статусах (защита от случайного удаления активных записей). */
const STATUSES_ALLOWED_TO_DELETE = new Set(['completed', 'cancelled', 'no_show']);

function normalizeStatusForDeleteRule(status) {
  if (status === 'no-show') return 'no_show';
  return status;
}

export async function deleteAppointment(id) {
  await requireSession();
  assertId(id, 'id');
  const bid = await getOwnerBusinessId();
  await requireRowInBusiness('appointments', id, bid, 'Запись');

  const { data: row, error } = await supabase
    .from('appointments')
    .select('status')
    .eq('id', id)
    .eq('business_id', bid)
    .maybeSingle();
  if (error) throwOnError({ data: null, error });

  const normalized = normalizeStatusForDeleteRule(row?.status);
  if (!row?.status || !STATUSES_ALLOWED_TO_DELETE.has(normalized)) {
    throw new ApiError(
      'Удалять можно только записи со статусами «Завершено», «Отменено» или «Не явился»',
      { code: 'validation_error', status: 400 }
    );
  }

  return throwOnError(
    await supabase.from('appointments').delete().eq('id', id).eq('business_id', bid)
  );
}

const REVENUE_MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/** Последние 6 календарных месяцев: выручка (completed) и число записей по месяцам — для кабинета, не платформенный admin. */
export async function getRevenueData() {
  const bid = await getOwnerBusinessId();
  const now = new Date();
  const slots = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    slots.push({ key, month: REVENUE_MONTH_LABELS[d.getMonth()] });
  }
  const startDate = `${slots[0].key}-01`;
  const res = await supabase
    .from('appointments')
    .select('date, price, status')
    .eq('business_id', bid)
    .gte('date', startDate)
    .order('date');
  const rows = throwOnError(res) ?? [];

  const agg = Object.fromEntries(slots.map((s) => [s.key, { revenue: 0, bookings: 0 }]));
  for (const row of rows) {
    const ds = row?.date;
    if (ds == null || String(ds).length < 7) continue;
    const mk = String(ds).slice(0, 7);
    if (!agg[mk]) continue;
    agg[mk].bookings += 1;
    if (row.status === 'completed') {
      agg[mk].revenue += Number(row.price) || 0;
    }
  }

  return slots.map((s) => ({
    month: s.month,
    revenue: agg[s.key].revenue,
    bookings: agg[s.key].bookings,
  }));
}
