import { supabase } from './supabase.js';

const FUNCTION_NAME = 'notify-appointment-telegram';

/**
 * @param {unknown} error
 * @returns {Promise<Record<string, unknown>>}
 */
async function summarizeInvokeError(error) {
  const out = {
    name: error?.name,
    message: error?.message ?? String(error),
  };
  const ctx = error?.context;
  if (ctx instanceof Response) {
    try {
      const t = await ctx.clone().text();
      out.status = ctx.status;
      out.responseBody = t.length > 800 ? `${t.slice(0, 800)}…` : t;
    } catch {
      out.responseBody = '(не удалось прочитать тело ответа)';
    }
  }
  return out;
}

/**
 * Уведомление о новой записи через Edge Function (секреты Telegram только на сервере Supabase).
 * Ошибки не пробрасываются — запись уже создана.
 * @param {Record<string, unknown>} appointment — строка после mapAppointmentRow
 */
export async function notifyNewAppointmentCreated(appointment) {
  const id = appointment?.id;
  if (id == null) {
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionToken = sessionData?.session?.access_token;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  const bearer = sessionToken || anonKey;
  const slug =
    appointment?.slug != null && String(appointment.slug).trim() !== ''
      ? String(appointment.slug).trim().toLowerCase()
      : null;

  if (!bearer) {
    console.warn('[telegram] пропуск: нет токена и anon key', { appointmentId: id });
    return;
  }
  if (!sessionToken && !slug) {
    console.warn('[telegram] пропуск: публичная запись без slug для Edge Function', { appointmentId: id });
    return;
  }

  try {
    console.info('[telegram] invoke', {
      function: FUNCTION_NAME,
      appointmentId: id,
      publicSlug: Boolean(slug && !sessionToken),
    });
    const fnClient = supabase.functions;
    fnClient.setAuth(bearer);
    const body = sessionToken
      ? { appointment_id: id }
      : { appointment_id: id, slug };
    const { data, error } = await fnClient.invoke(FUNCTION_NAME, { body });

    if (error) {
      console.error('[telegram] Edge Function invoke failed', {
        appointmentId: id,
        ...(await summarizeInvokeError(error)),
      });
      return;
    }

    console.info('[telegram] Edge Function response', {
      appointmentId: id,
      data: data ?? null,
    });

    if (data && typeof data === 'object' && data.skipped === true) {
      console.warn(
        '[telegram] функция отработала, но сообщение в Telegram не отправлялась (смотри data.reason / data.missing в логе выше)',
        { appointmentId: id, data },
      );
    }
  } catch (err) {
    console.error('[telegram] Edge Function exception', {
      appointmentId: id,
      error: err?.message ?? String(err),
    });
  }
}
