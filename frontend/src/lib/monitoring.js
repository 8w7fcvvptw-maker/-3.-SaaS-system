const APP_NAME = "saas-frontend";

function monitoringIngestEnabled() {
  return import.meta.env.VITE_YC_MONITORING_INGEST === "true";
}

function monitoringIngestHeaders() {
  const secret = import.meta.env.VITE_MONITORING_INGEST_SECRET;
  return {
    "Content-Type": "application/json",
    ...(typeof secret === "string" && secret.trim() ? { "x-monitoring-secret": secret.trim() } : {}),
  };
}

function postErrorToApi(message, context = {}) {
  if (!monitoringIngestEnabled() || typeof fetch === "undefined") return;
  const path = "/api/monitoring/ingest";
  const body = {
    kind: "error",
    message: String(message).slice(0, 2000),
    name: "FrontendError",
    ...(context.tags?.area ? { area: String(context.tags.area) } : {}),
    ...(context.tags?.action ? { action: String(context.tags.action) } : {}),
  };
  void fetch(path, {
    method: "POST",
    headers: monitoringIngestHeaders(),
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

function injectYandexMetrika(counterId) {
  if (!counterId || typeof window === "undefined") return;
  if (document.getElementById("yandex-metrika-script")) return;

  window.ym =
    window.ym ||
    function ymProxy(...args) {
      (window.ym.a = window.ym.a || []).push(args);
    };
  window.ym.l = Date.now();

  const script = document.createElement("script");
  script.id = "yandex-metrika-script";
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  window.ym(counterId, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  });
}

/** Инициализация: Метрика + подготовка к отправке ошибок на бэкенд (→ Yandex Cloud Monitoring). */
export function initMonitoring() {
  injectYandexMetrika(import.meta.env.VITE_YANDEX_METRIKA_ID);
}

export function captureError(error, context = {}) {
  const msg = error?.message || String(error);
  const payload = {
    level: "error",
    event: "frontend.error",
    app: APP_NAME,
    message: msg,
    ...(context.extra ? { extra: context.extra } : {}),
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));

  postErrorToApi(msg, context);
}

export function trackBusinessEvent(event, data = {}) {
  const payload = {
    level: "info",
    event: `frontend.business.${event}`,
    app: APP_NAME,
    data,
    timestamp: new Date().toISOString(),
  };
  console.info(JSON.stringify(payload));

  if (typeof window !== "undefined" && typeof window.ym === "function") {
    const counterId = import.meta.env.VITE_YANDEX_METRIKA_ID;
    if (counterId) {
      window.ym(Number(counterId), "reachGoal", event, data);
    }
  }
}
