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

  // getSession читает из localStorage — не делает сетевой запрос.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    console.warn('[telegram] пропуск: нет access_token в сессии', { appointmentId: id });
    return;
  }

  try {
    console.info('[telegram] invoke', { function: FUNCTION_NAME, appointmentId: id });
    // supabase.functions — геттер, каждый раз новый экземпляр FunctionsClient.
    // Получаем его один раз, ставим токен и вызываем invoke на том же объекте.
    const fnClient = supabase.functions;
    fnClient.setAuth(token);
    const { data, error } = await fnClient.invoke(FUNCTION_NAME, {
      body: { appointment_id: id },
    });

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
