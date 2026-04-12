/**
 * Утилиты для Vercel Serverless: прокси /api/* → Railway (AUTH_API_UPSTREAM).
 * Запрос браузера идёт на тот же домен (vercel.app) — без CORS и mixed content.
 */

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
