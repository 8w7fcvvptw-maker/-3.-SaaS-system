import crypto from "node:crypto";
import {
  initYcMonitoring,
  isYcMonitoringEnabled,
  reportBusinessEventMetric,
  reportFrontendErrorMetric,
  reportServerErrorMetric,
} from "./yc-monitoring.mjs";

const APP_NAME = "auth-api";

function nowIso() {
  return new Date().toISOString();
}

function sanitizeUrl(url) {
  return typeof url === "string" ? url.split("?")[0] : "";
}

/** Инициализация наблюдаемости (метрики Yandex Cloud Monitoring при наличии учётных данных). */
export function initObservability() {
  return initYcMonitoring();
}

function emit(level, event, fields = {}) {
  const payload = {
    level,
    event,
    app: APP_NAME,
    timestamp: nowIso(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

export function requestContextMiddleware(req, res, next) {
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  req._requestStartedAt = Date.now();
  next();
}

export function requestLogMiddleware(req, res, next) {
  res.on("finish", () => {
    const durationMs = Math.max(0, Date.now() - (req._requestStartedAt || Date.now()));
    emit("info", "http.request", {
      requestId: req.requestId,
      method: req.method,
      path: sanitizeUrl(req.originalUrl || req.url),
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });
  });
  next();
}

export function logBusinessEvent(event, fields = {}) {
  emit("info", `business.${event}`, fields);
  if (isYcMonitoringEnabled()) {
    void reportBusinessEventMetric(event, {
      ...(typeof fields.plan === "string" ? { plan: fields.plan } : {}),
      ...(fields.paymentId != null ? { paymentId: fields.paymentId } : {}),
    }).catch(() => {});
  }
}

export function logError(error, fields = {}) {
  const message = error?.message || "Unknown error";
  emit("error", "app.error", {
    message,
    name: error?.name || null,
    stack: error?.stack || null,
    ...fields,
  });
  if (!isYcMonitoringEnabled()) return;

  if (fields.frontend) {
    void reportFrontendErrorMetric(fields).catch(() => {});
  } else {
    void reportServerErrorMetric(fields).catch(() => {});
  }
}
