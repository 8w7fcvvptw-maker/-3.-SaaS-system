import { throwOnError } from './helpers.js';
import { supabase } from './supabase.js';
import { requireSession } from './auth.js';
import { getOwnerBusinessId } from './business.js';
import { assertId, assertNonEmptyString, assertPositiveInt, optionalString } from './validation.js';
import { ApiError } from './errors.js';

const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    template_key: 'appointment_created',
    name: 'Подтверждение записи',
    trigger_event: 'appointment_created',
    trigger_offset_minutes: 0,
    channel: 'sms_email',
    subject: 'Подтверждение записи',
    body: 'Ваша запись подтверждена. Ждём вас в назначенное время.',
    active: true,
  },
  {
    template_key: 'appointment_reminder_24h',
    name: 'Напоминание за 24 часа',
    trigger_event: 'appointment_reminder',
    trigger_offset_minutes: -1440,
    channel: 'sms',
    subject: 'Напоминание о записи',
    body: 'Напоминаем о записи завтра. Если планы изменились, пожалуйста, отмените визит заранее.',
    active: true,
  },
  {
    template_key: 'appointment_cancelled',
    name: 'Отмена записи',
    trigger_event: 'appointment_cancelled',
    trigger_offset_minutes: 0,
    channel: 'sms_email',
    subject: 'Запись отменена',
    body: 'Ваша запись была отменена. Вы можете выбрать новое удобное время.',
    active: true,
  },
  {
    template_key: 'post_visit_followup',
    name: 'Follow-up после визита',
    trigger_event: 'appointment_followup',
    trigger_offset_minutes: 1440,
    channel: 'email',
    subject: 'Спасибо за визит',
    body: 'Спасибо, что были у нас. Будем рады отзыву и новой встрече.',
    active: false,
  },
];

const ALLOWED_NOTIFICATION_CHANNELS = new Set(['sms', 'email', 'sms_email']);
const DEFAULT_NOTIFICATION_PREFS = {
  notifications_email_enabled: true,
  notifications_sms_enabled: true,
  sms_addon_enabled: false,
};

function assertNotificationChannel(value, field = 'channel') {
  const channel = assertNonEmptyString(value, field, 32).toLowerCase();
  if (!ALLOWED_NOTIFICATION_CHANNELS.has(channel)) {
    throw new ApiError('Некорректный канал уведомления', { field, code: 'validation_error', status: 400 });
  }
  return channel;
}

function normalizeOffset(value) {
  const offset = Number(value ?? 0);
  if (!Number.isFinite(offset) || Math.floor(offset) !== offset) {
    throw new ApiError('trigger_offset_minutes должен быть целым числом', {
      field: 'trigger_offset_minutes',
      code: 'validation_error',
      status: 400,
    });
  }
  if (offset < -10080 || offset > 10080) {
    throw new ApiError('trigger_offset_minutes вне допустимого диапазона', {
      field: 'trigger_offset_minutes',
      code: 'validation_error',
      status: 400,
    });
  }
  return offset;
}

async function ensureDefaultTemplates(businessId) {
  const existing = throwOnError(
    await supabase
      .from('notification_templates')
      .select('id')
      .eq('business_id', businessId)
      .limit(1)
  );
  if (Array.isArray(existing) && existing.length > 0) return;

  const rows = DEFAULT_NOTIFICATION_TEMPLATES.map((tpl) => ({
    business_id: businessId,
    ...tpl,
  }));
  throwOnError(await supabase.from('notification_templates').insert(rows));
}

export async function getNotificationTemplates() {
  await requireSession();
  const businessId = await getOwnerBusinessId();
  await ensureDefaultTemplates(businessId);

  return throwOnError(
    await supabase
      .from('notification_templates')
      .select('*')
      .eq('business_id', businessId)
      .order('id')
  );
}

export async function createNotificationTemplate(payload) {
  await requireSession();
  const businessId = await getOwnerBusinessId();

  const name = assertNonEmptyString(payload?.name, 'name', 200);
  const triggerEvent = assertNonEmptyString(payload?.trigger_event ?? payload?.trigger, 'trigger_event', 100);
  const channel = assertNotificationChannel(payload?.channel, 'channel');
  const body = assertNonEmptyString(payload?.body, 'body', 4000);

  const row = {
    business_id: businessId,
    template_key: optionalString(payload?.template_key, 'template_key', 120) ?? `custom_${Date.now()}`,
    name,
    trigger_event: triggerEvent,
    trigger_offset_minutes: normalizeOffset(payload?.trigger_offset_minutes),
    channel,
    subject: optionalString(payload?.subject, 'subject', 200),
    body,
    active: payload?.active !== false,
  };

  return throwOnError(
    await supabase.from('notification_templates').insert(row).select('*').single()
  );
}

export async function updateNotificationTemplate(id, updates) {
  await requireSession();
  const businessId = await getOwnerBusinessId();
  const templateId = assertId(id, 'id');

  const patch = { updated_at: new Date().toISOString() };
  if (updates?.name !== undefined) patch.name = assertNonEmptyString(updates.name, 'name', 200);
  if (updates?.trigger_event !== undefined || updates?.trigger !== undefined) {
    patch.trigger_event = assertNonEmptyString(
      updates.trigger_event ?? updates.trigger,
      'trigger_event',
      100
    );
  }
  if (updates?.channel !== undefined) patch.channel = assertNotificationChannel(updates.channel, 'channel');
  if (updates?.body !== undefined) patch.body = assertNonEmptyString(updates.body, 'body', 4000);
  if (updates?.subject !== undefined) patch.subject = optionalString(updates.subject, 'subject', 200);
  if (updates?.active !== undefined) patch.active = Boolean(updates.active);
  if (updates?.trigger_offset_minutes !== undefined) {
    patch.trigger_offset_minutes = normalizeOffset(updates.trigger_offset_minutes);
  }

  if (Object.keys(patch).length === 1) {
    throw new ApiError('Нет полей для обновления', { code: 'validation_error', status: 400 });
  }

  return throwOnError(
    await supabase
      .from('notification_templates')
      .update(patch)
      .eq('id', templateId)
      .eq('business_id', businessId)
      .select('*')
      .single()
  );
}

export async function deleteNotificationTemplate(id) {
  await requireSession();
  const businessId = await getOwnerBusinessId();
  const templateId = assertId(id, 'id');
  return throwOnError(
    await supabase
      .from('notification_templates')
      .delete()
      .eq('id', templateId)
      .eq('business_id', businessId)
  );
}

export async function getNotificationEvents(limit = 20) {
  await requireSession();
  const businessId = await getOwnerBusinessId();
  const safeLimit = Math.min(assertPositiveInt(limit, 'limit'), 100);

  return throwOnError(
    await supabase
      .from('notification_events')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(safeLimit)
  );
}

function pickRecipient(channel, appointment) {
  const phone = appointment?.client_phone ?? null;
  const email = appointment?.client_email ?? null;
  if (channel === 'sms') return phone;
  if (channel === 'email') return email;
  if (channel === 'sms_email') {
    if (phone && email) return `${phone}, ${email}`;
    return phone || email || null;
  }
  return null;
}

export async function enqueueNotificationEventsForAppointment(eventType, appointment) {
  const safeEventType = assertNonEmptyString(eventType, 'event_type', 100);
  const businessId = assertId(
    Number(appointment?.business_id ?? appointment?.businessId),
    'business_id'
  );
  const appointmentId = assertId(
    Number(appointment?.id),
    'appointment_id'
  );

  const prefs = await getNotificationPreferences(businessId);
  const templates = throwOnError(
    await supabase
      .from('notification_templates')
      .select('id, channel')
      .eq('business_id', businessId)
      .eq('trigger_event', safeEventType)
      .eq('active', true)
  );
  if (!templates?.length) return [];

  const payload = {
    appointment_id: appointmentId,
    client_name: appointment?.client_name ?? appointment?.clientName ?? null,
    service: appointment?.service ?? null,
    date: appointment?.date ?? null,
    time: appointment?.time ?? null,
  };

  const rows = templates
    .map((template) => {
      const channel = resolveEffectiveChannel(template.channel, prefs);
      if (!channel) return null;
      return {
        business_id: businessId,
        template_id: template.id,
        appointment_id: appointmentId,
        event_type: safeEventType,
        channel,
        status: 'queued',
        recipient: pickRecipient(channel, appointment),
        payload,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return [];

  return throwOnError(
    await supabase.from('notification_events').insert(rows).select('*')
  );
}

function parseAppointmentDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const time = String(timeValue).trim();
  const normalizedTime = /^\d{1,2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const appointmentAt = new Date(`${String(dateValue).slice(0, 10)}T${normalizedTime}`);
  if (Number.isNaN(appointmentAt.getTime())) return null;
  return appointmentAt;
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function getStatusesForTemplate(triggerEvent) {
  if (triggerEvent === 'appointment_reminder') return ['pending', 'confirmed'];
  if (triggerEvent === 'appointment_followup') return ['completed'];
  return [];
}

function toSafePositiveInt(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.floor(n) !== n || n <= 0) return fallback;
  return Math.min(n, max);
}

async function getNotificationPreferences(businessId, supabaseClient = supabase) {
  const { data, error } = await supabaseClient
    .from('business_booking_settings')
    .select('notifications_email_enabled, notifications_sms_enabled, sms_addon_enabled')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_NOTIFICATION_PREFS };
  return {
    notifications_email_enabled: data.notifications_email_enabled !== false,
    notifications_sms_enabled: data.notifications_sms_enabled !== false,
    sms_addon_enabled: data.sms_addon_enabled === true,
  };
}

function resolveEffectiveChannel(channel, prefs) {
  const emailEnabled = prefs.notifications_email_enabled !== false;
  const smsEnabled = prefs.notifications_sms_enabled !== false && prefs.sms_addon_enabled === true;
  if (channel === 'email') return emailEnabled ? 'email' : null;
  if (channel === 'sms') return smsEnabled ? 'sms' : null;
  if (channel === 'sms_email') {
    if (smsEnabled && emailEnabled) return 'sms_email';
    if (smsEnabled) return 'sms';
    if (emailEnabled) return 'email';
    return null;
  }
  return null;
}

/**
 * Планировщик постановки уведомлений (queue-only, без провайдеров отправки).
 * Предназначен для запуска по cron/worker через серверный endpoint.
 */
export async function runNotificationEventScheduler(options = {}) {
  const supabaseClient = options.supabaseClient ?? supabase;
  const now = options.now instanceof Date ? options.now : new Date();
  const lookbehindMinutes = toSafePositiveInt(options.lookbehindMinutes, 15, 24 * 60);
  const maxTemplates = toSafePositiveInt(options.maxTemplates, 200, 2000);
  const maxAppointmentsPerTemplate = toSafePositiveInt(options.maxAppointmentsPerTemplate, 300, 5000);

  const templates = throwOnError(
    await supabaseClient
      .from('notification_templates')
      .select('id, business_id, trigger_event, trigger_offset_minutes, channel')
      .eq('active', true)
      .in('trigger_event', ['appointment_reminder', 'appointment_followup'])
      .limit(maxTemplates)
  );

  if (!templates?.length) {
    return { checked_templates: 0, checked_appointments: 0, enqueued_events: 0 };
  }

  const windowEnd = now;
  const windowStart = new Date(now.getTime() - lookbehindMinutes * 60000);
  let checkedAppointments = 0;
  let enqueuedEvents = 0;

  for (const template of templates) {
    const statuses = getStatusesForTemplate(template.trigger_event);
    if (statuses.length === 0) continue;

    const offsetMinutes = Number(template.trigger_offset_minutes ?? 0);
    const appointmentsMin = new Date(windowStart.getTime() - offsetMinutes * 60000);
    const appointmentsMax = new Date(windowEnd.getTime() - offsetMinutes * 60000);
    const minDate = toIsoDate(appointmentsMin < appointmentsMax ? appointmentsMin : appointmentsMax);
    const maxDate = toIsoDate(appointmentsMin < appointmentsMax ? appointmentsMax : appointmentsMin);

    const appointments = throwOnError(
      await supabaseClient
        .from('appointments')
        .select('id, business_id, date, time, status, client_name, client_phone, client_email, service')
        .eq('business_id', template.business_id)
        .in('status', statuses)
        .gte('date', minDate)
        .lte('date', maxDate)
        .limit(maxAppointmentsPerTemplate)
    );
    if (!appointments?.length) continue;

    const dueAppointments = [];
    for (const appointment of appointments) {
      const appointmentAt = parseAppointmentDateTime(appointment.date, appointment.time);
      if (!appointmentAt) continue;
      const dueAt = new Date(appointmentAt.getTime() + offsetMinutes * 60000);
      if (dueAt < windowStart || dueAt > windowEnd) continue;
      dueAppointments.push(appointment);
    }
    if (dueAppointments.length === 0) continue;

    checkedAppointments += dueAppointments.length;
    const dueIds = dueAppointments.map((item) => item.id).filter((id) => Number.isFinite(Number(id)));
    if (dueIds.length === 0) continue;

    const existingEvents = throwOnError(
      await supabaseClient
        .from('notification_events')
        .select('appointment_id')
        .eq('template_id', template.id)
        .eq('event_type', template.trigger_event)
        .in('appointment_id', dueIds)
    );
    const existingAppointmentIds = new Set((existingEvents ?? []).map((row) => row.appointment_id));

    const rowsToInsert = dueAppointments
      .filter((appointment) => !existingAppointmentIds.has(appointment.id))
      .map((appointment) => ({
        business_id: template.business_id,
        template_id: template.id,
        appointment_id: appointment.id,
        event_type: template.trigger_event,
        channel: template.channel,
        status: 'queued',
        recipient: pickRecipient(template.channel, appointment),
        payload: {
          appointment_id: appointment.id,
          client_name: appointment.client_name ?? null,
          service: appointment.service ?? null,
          date: appointment.date ?? null,
          time: appointment.time ?? null,
        },
      }));

    if (rowsToInsert.length === 0) continue;

    const inserted = throwOnError(
      await supabaseClient.from('notification_events').insert(rowsToInsert).select('id')
    );
    enqueuedEvents += inserted?.length ?? 0;
  }

  return {
    checked_templates: templates.length,
    checked_appointments: checkedAppointments,
    enqueued_events: enqueuedEvents,
  };
}
