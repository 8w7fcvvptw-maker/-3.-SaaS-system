import { getUpstreamOrigin, readBodyBuffer, upstreamFetch, upstreamFetchErrorDetail } from "../_util.mjs";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed", code: "method_not_allowed" });
  }

  const origin = getUpstreamOrigin();
  if (!origin) {
    return res.status(503).json({
      message:
        "Задайте в Vercel переменную AUTH_API_UPSTREAM (HTTPS URL API на Railway, без слэша в конце), Environment: Production, затем Redeploy.",
      code: "proxy_misconfigured",
    });
  }

  try {
    const buf = await readBodyBuffer(req);
    const headers = { "Content-Type": "application/json" };
    const auth = req.headers.authorization;
    if (auth) headers.Authorization = auth;

    const upstream = await upstreamFetch(`${origin}/api/payments/create`, {
      method: "POST",
      headers,
      body: buf.length ? buf : Buffer.from("{}"),
    });
    const text = await upstream.text();
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    return res.status(upstream.status).send(text);
  } catch (e) {
    const detail = upstreamFetchErrorDetail(e);
    console.error("[vercel-proxy] /api/payments/create", detail, e);
    return res.status(502).json({
      message: `Прокси не смог вызвать Railway (${detail}). Проверьте AUTH_API_UPSTREAM и /health на Railway.`,
      code: "upstream_unreachable",
    });
  }
}
