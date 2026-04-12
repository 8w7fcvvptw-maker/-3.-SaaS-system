/**
 * Базовый URL API из env для запросов из браузера.
 * Страница на https:// (Vercel) не может вызывать http:// API (mixed content) → в консоли net::ERR_FAILED.
 */
export function normalizeBrowserApiBase(raw) {
  if (typeof raw !== "string") return "";
  let base = raw.replace(/\/$/, "").trim();
  if (
    typeof globalThis !== "undefined" &&
    globalThis.window?.location?.protocol === "https:" &&
    base.startsWith("http://")
  ) {
    base = `https://${base.slice("http://".length)}`;
  }
  return base;
}
