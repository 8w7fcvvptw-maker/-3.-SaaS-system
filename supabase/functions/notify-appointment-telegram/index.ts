import { createClient } from "npm:@supabase/supabase-js@2";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

/** Список origin через запятую в ALLOWED_ORIGINS (секреты Edge Function). Без слеша в конце. */
function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS")?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => normalizeOrigin(s.trim()))
      .filter(Boolean);
  }
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
  ];
}

function getCorsHeaders(req: Request): {
  cors: Record<string, string> | null;
  originForbidden: boolean;
} {
  const origin = req.headers.get("Origin");
  if (!origin) {
    return { cors: null, originForbidden: false };
  }
  const normalized = normalizeOrigin(origin);
  const allowed = getAllowedOrigins();
  if (!allowed.includes(normalized)) {
    return { cors: null, originForbidden: true };
  }
  return {
    cors: {
      "Access-Control-Allow-Origin": normalized,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
    originForbidden: false,
  };
}

function mergeJsonHeaders(
  cors: Record<string, string> | null,
): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  return cors ? { ...cors, ...base } : base;
}

function maskToken(token: string): string {
  if (!token || token.length <= 8) return "***";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function maskChatId(chatId: string): string {
  if (!chatId || chatId.length <= 4) return "***";
  return `…${chatId.slice(-4)}`;
}

function summarizeTelegramApiBodyForLog(parsed: Record<string, unknown>) {
  if (parsed.ok === false) {
    return {
      ok: false,
      error_code: parsed.error_code,
      description: parsed.description,
    };
  }
  if (parsed.ok === true && parsed.result && typeof parsed.result === "object") {
    const r = parsed.result as Record<string, unknown>;
    const chat = r.chat as Record<string, unknown> | undefined;
    return {
      ok: true,
      message_id: r.message_id,
      chat_id: chat?.id != null ? maskChatId(String(chat.id)) : undefined,
    };
  }
  return { ok: parsed.ok };
}

Deno.serve(async (req) => {
  const { cors, originForbidden } = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    if (originForbidden || !cors) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: mergeJsonHeaders(cors),
    });
  }

  if (originForbidden) {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: mergeJsonHeaders(null),
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: mergeJsonHeaders(cors),
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error("[notify-appointment-telegram] missing Supabase env");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: mergeJsonHeaders(cors),
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: mergeJsonHeaders(cors),
    });
  }

  let body: { appointment_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: mergeJsonHeaders(cors),
    });
  }

  const rawId = body?.appointment_id;
  const appointmentId = typeof rawId === "number" ? rawId : Number(rawId);
  if (rawId == null || Number.isNaN(appointmentId) || appointmentId <= 0) {
    return new Response(JSON.stringify({ error: "appointment_id required" }), {
      status: 400,
      headers: mergeJsonHeaders(cors),
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: row, error: fetchErr } = await admin
    .from("appointments")
    .select("id, business_id, service_id, staff_id, client_name, client_phone, date, time")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[notify-appointment-telegram] fetch appointment", {
      appointmentId,
      error: fetchErr.message,
    });
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: mergeJsonHeaders(cors),
    });
  }

  if (!row) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: mergeJsonHeaders(cors),
    });
  }

  const { data: biz, error: bizErr } = await admin
    .from("businesses")
    .select("name, slug, user_id")
    .eq("id", row.business_id)
    .maybeSingle();

  if (bizErr) {
    console.error("[notify-appointment-telegram] fetch business", {
      appointmentId,
      business_id: row.business_id,
      error: bizErr.message,
    });
    return new Response(JSON.stringify({ error: "Business not found" }), {
      status: 404,
      headers: mergeJsonHeaders(cors),
    });
  }

  if (!biz?.user_id || biz.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: mergeJsonHeaders(cors),
    });
  }

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  const chatIdRaw = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();
  if (!token || !chatIdRaw) {
    const missing: string[] = [];
    if (!token) missing.push("TELEGRAM_BOT_TOKEN");
    if (!chatIdRaw) missing.push("TELEGRAM_CHAT_ID");
    console.warn("[notify-appointment-telegram] skip: нет секретов Telegram", { missing });
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: "missing_telegram_secrets",
        missing,
      }),
      { headers: mergeJsonHeaders(cors) },
    );
  }

  /** Telegram принимает число или строку; из env часто приходит строка — для чистых целых шлём number. */
  const telegramChatId = /^-?\d+$/.test(chatIdRaw) ? Number(chatIdRaw) : chatIdRaw;

  let serviceName = "—";
  if (row.service_id != null) {
    const { data: svc } = await admin
      .from("services")
      .select("name")
      .eq("id", row.service_id)
      .maybeSingle();
    if (svc?.name) serviceName = svc.name;
  }

  let staffName: string | null = null;
  if (row.staff_id != null) {
    const { data: stf } = await admin
      .from("staff")
      .select("name")
      .eq("id", row.staff_id)
      .maybeSingle();
    if (stf?.name) staffName = stf.name;
  }

  const lines = [
    "📋 Новая запись",
    `ID: ${row.id ?? "—"}`,
    `Клиент: ${row.client_name ?? "—"}`,
    `Телефон: ${row.client_phone ?? "—"}`,
    `Дата и время: ${row.date ?? "—"} ${row.time ?? ""}`.trim(),
    `Услуга: ${serviceName}`,
  ];
  if (staffName) lines.push(`Мастер: ${staffName}`);
  const bizParts = [biz.name, biz.slug ? `slug: ${biz.slug}` : null].filter(Boolean);
  if (bizParts.length) lines.push(`Салон: ${bizParts.join(" · ")}`);

  const text = lines.join("\n");
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const urlForLog = `https://api.telegram.org/bot${maskToken(token)}/sendMessage`;

  try {
    console.info("[notify-appointment-telegram] sendMessage request", {
      url: urlForLog,
      chat_id: maskChatId(String(chatIdRaw)),
      textLength: text.length,
      appointmentId,
    });

    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    const raw = await tgRes.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    const bodyForLog = parsed
      ? summarizeTelegramApiBodyForLog(parsed)
      : raw.length > 800
        ? `${raw.slice(0, 800)}…`
        : raw;

    console.info("[notify-appointment-telegram] sendMessage response", {
      status: tgRes.status,
      ok: tgRes.ok,
      body: bodyForLog,
    });

    if (!tgRes.ok) {
      throw new Error(
        `Telegram HTTP ${tgRes.status}: ${
          typeof bodyForLog === "string" ? bodyForLog : JSON.stringify(bodyForLog)
        }`,
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: mergeJsonHeaders(cors),
    });
  } catch (err) {
    console.error("[notify-appointment-telegram] sendMessage failed", {
      appointmentId,
      business_id: row.business_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response(JSON.stringify({ ok: false, error: "telegram_failed" }), {
      status: 502,
      headers: mergeJsonHeaders(cors),
    });
  }
});
