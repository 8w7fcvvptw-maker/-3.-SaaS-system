import * as Sentry from "@sentry/react";

const APP_NAME = "saas-frontend";

let sentryEnabled = false;

function safeParseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const env = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || "development";
  const release = import.meta.env.VITE_APP_VERSION || "local";
  const tracesSampleRate = safeParseNumber(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) ?? 0.2;
  const counterId = import.meta.env.VITE_YANDEX_METRIKA_ID;

  if (dsn) {
    Sentry.init({
      dsn,
      environment: env,
      release,
      tracesSampleRate,
    });
    sentryEnabled = true;
  }

  injectYandexMetrika(counterId);
}

export function captureError(error, context = {}) {
  if (sentryEnabled) {
    Sentry.captureException(error, {
      tags: { app: APP_NAME, ...context.tags },
      extra: context.extra,
      level: context.level || "error",
    });
  }

  const payload = {
    level: "error",
    event: "frontend.error",
    app: APP_NAME,
    message: error?.message || String(error),
    ...(context.extra ? { extra: context.extra } : {}),
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
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
