import { supabase } from './supabase.js';
import { throwOnError } from './helpers.js';
import { requireSession } from './auth.js';
import { getOwnerBusinessId } from './business.js';
import { ApiError } from './errors.js';

const DEFAULT_BOOKING_SETTINGS = {
  onlineBookingEnabled: true,
  bufferMinutes: 15,
  cancellationHours: 24,
  reminderHours: 24,
  notificationsEmailEnabled: true,
  notificationsSmsEnabled: true,
  smsAddonEnabled: false,
  advancedNotificationsEnabled: false,
  depositEnabled: false,
  depositAmount: 0,
  selfServiceLinksEnabled: false,
};

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.floor(n) !== n) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampMoney(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeRow(row) {
  if (!row) return { ...DEFAULT_BOOKING_SETTINGS };
  return {
    onlineBookingEnabled: row.online_booking_enabled !== false,
    bufferMinutes: clampInt(row.buffer_minutes, 0, 180, DEFAULT_BOOKING_SETTINGS.bufferMinutes),
    cancellationHours: clampInt(row.cancellation_hours, 0, 720, DEFAULT_BOOKING_SETTINGS.cancellationHours),
    reminderHours: clampInt(row.reminder_hours, 0, 720, DEFAULT_BOOKING_SETTINGS.reminderHours),
    notificationsEmailEnabled: row.notifications_email_enabled !== false,
    notificationsSmsEnabled: row.notifications_sms_enabled !== false,
    smsAddonEnabled: row.sms_addon_enabled === true,
    advancedNotificationsEnabled: row.advanced_notifications_enabled === true,
    depositEnabled: row.deposit_enabled === true,
    depositAmount: clampMoney(row.deposit_amount, 0, 500000, 0),
    selfServiceLinksEnabled: row.self_service_links_enabled === true,
  };
}

function normalizePatch(patch) {
  const out = {};
  if (patch.onlineBookingEnabled !== undefined) out.online_booking_enabled = Boolean(patch.onlineBookingEnabled);
  if (patch.bufferMinutes !== undefined) out.buffer_minutes = clampInt(patch.bufferMinutes, 0, 180, 15);
  if (patch.cancellationHours !== undefined) out.cancellation_hours = clampInt(patch.cancellationHours, 0, 720, 24);
  if (patch.reminderHours !== undefined) out.reminder_hours = clampInt(patch.reminderHours, 0, 720, 24);
  if (patch.notificationsEmailEnabled !== undefined) out.notifications_email_enabled = Boolean(patch.notificationsEmailEnabled);
  if (patch.notificationsSmsEnabled !== undefined) out.notifications_sms_enabled = Boolean(patch.notificationsSmsEnabled);
  if (patch.smsAddonEnabled !== undefined) out.sms_addon_enabled = Boolean(patch.smsAddonEnabled);
  if (patch.advancedNotificationsEnabled !== undefined) out.advanced_notifications_enabled = Boolean(patch.advancedNotificationsEnabled);
  if (patch.depositEnabled !== undefined) out.deposit_enabled = Boolean(patch.depositEnabled);
  if (patch.depositAmount !== undefined) out.deposit_amount = clampMoney(patch.depositAmount, 0, 500000, 0);
  if (patch.selfServiceLinksEnabled !== undefined) out.self_service_links_enabled = Boolean(patch.selfServiceLinksEnabled);
  return out;
}

async function ensureRow(businessId) {
  const existing = throwOnError(
    await supabase
      .from('business_booking_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle()
  );
  if (existing) return existing;
  const created = throwOnError(
    await supabase
      .from('business_booking_settings')
      .insert({ business_id: businessId })
      .select('*')
      .single()
  );
  return created;
}

export async function getBusinessBookingSettings() {
  await requireSession();
  const businessId = await getOwnerBusinessId({ requireSubscription: false });
  const row = await ensureRow(businessId);
  return normalizeRow(row);
}

export async function updateBusinessBookingSettings(patch) {
  await requireSession();
  const businessId = await getOwnerBusinessId({ requireSubscription: false });
  const safePatch = normalizePatch(patch ?? {});
  if (Object.keys(safePatch).length === 0) {
    throw new ApiError('Нет полей для обновления', { code: 'validation_error', status: 400 });
  }

  const updated = throwOnError(
    await supabase
      .from('business_booking_settings')
      .upsert({ business_id: businessId, ...safePatch }, { onConflict: 'business_id' })
      .select('*')
      .single()
  );

  if (safePatch.reminder_hours !== undefined) {
    await supabase
      .from('notification_templates')
      .update({ trigger_offset_minutes: -Math.abs(safePatch.reminder_hours * 60) })
      .eq('business_id', businessId)
      .eq('trigger_event', 'appointment_reminder');
  }

  return normalizeRow(updated);
}
