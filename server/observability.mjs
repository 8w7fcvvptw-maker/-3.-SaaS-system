import crypto from "node:crypto";
import * as Sentry from "@sentry/node";

const APP_NAME = "auth-api";

function nowIso() {
  return new Date().toISOString();
}

function safeParseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sanitizeUrl(url) {
  return typeof url === "string" ? url.split("?")[0] : "";
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV || "development",
    tracesSampleRate: safeParseNumber(process.env.SENTRY_TRACES_SAMPLE_RATE) ?? 0.2,
    release: process.env.APP_VERSION || "local",
  });
  return true;
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
}

export function logError(error, fields = {}) {
  const message = error?.message || "Unknown error";
  emit("error", "app.error", {
    message,
    name: error?.name || null,
    stack: error?.stack || null,
    ...fields,
  });
  Sentry.captureException(error, {
    tags: fields.tags,
    extra: fields,
  });
}
