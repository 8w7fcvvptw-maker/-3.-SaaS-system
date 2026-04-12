/**
 * Утилиты для Vercel Serverless: прокси /api/* → Railway (AUTH_API_UPSTREAM).
 * Запрос браузера идёт на тот же домен (vercel.app) — без CORS и mixed content.
 */
import dns from "node:dns";

/** Снижает «fetch failed» при обращении Node к Railway (часто из‑за IPv6). */
dns.setDefaultResultOrder("ipv4first");

export function getUpstreamOrigin() {
  const u = process.env.AUTH_API_UPSTREAM || process.env.RAILWAY_API_URL;
  if (typeof u !== "string" || !u.trim()) return "";
  let s = u.trim().replace(/\/$/, "");
  if (s.startsWith("http://")) {
    s = `https://${s.slice("http://".length)}`;
  }
  return s;
}

/** Тело запроса как Buffer (Vercel может отдать уже распарсенный объект). */
export async function readBodyBuffer(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
    if (typeof req.body === "object") return Buffer.from(JSON.stringify(req.body), "utf8");
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Человекочитаемая причина падения fetch (Node / undici). */
export function upstreamFetchErrorDetail(err) {
  const c = err?.cause;
  const bits = [
    err?.code,
    typeof err?.message === "string" ? err.message : "",
    c?.code,
    typeof c?.message === "string" ? c.message : "",
    c?.errno != null ? `errno=${c.errno}` : "",
  ].filter(Boolean);
  const uniq = [...new Set(bits.map((s) => String(s).trim()).filter(Boolean))];
  return uniq.join(" · ").slice(0, 400) || "network_error";
}

/** fetch к Railway с таймаутом (мс из AUTH_UPSTREAM_TIMEOUT_MS или 25000). */
export async function upstreamFetch(url, init = {}) {
  const ms = Math.min(120_000, Math.max(5_000, Number(process.env.AUTH_UPSTREAM_TIMEOUT_MS) || 25_000));
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}
