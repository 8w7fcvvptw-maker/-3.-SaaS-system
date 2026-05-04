import { getUpstreamOrigin, upstreamFetch, upstreamFetchErrorDetail } from "../_util.mjs";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed", code: "method_not_allowed" });
  }

  const origin = getUpstreamOrigin();
  if (!origin) {
    return res.status(503).json({
      message: "Задайте AUTH_API_UPSTREAM в Vercel (HTTPS URL Railway auth-api).",
      code: "proxy_misconfigured",
    });
  }

  try {
    const upstream = await upstreamFetch(`${origin}/api/admin/businesses`, {
      method: "GET",
      headers: { Authorization: req.headers.authorization ?? "" },
    });
    const text = await upstream.text();
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    return res.status(upstream.status).send(text);
  } catch (e) {
    const detail = upstreamFetchErrorDetail(e);
    console.error("[vercel-proxy] /api/admin/businesses", detail, e);
    return res.status(502).json({
      message: `Прокси не смог вызвать Railway (${detail}). Проверьте AUTH_API_UPSTREAM.`,
      code: "upstream_unreachable",
    });
  }
}
