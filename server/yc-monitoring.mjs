import {
  YandexCloudMonitoringMetricsLogger,
  YandexMetricType,
} from "yandex-cloud-monitoring-metrics";

/** @type {InstanceType<typeof YandexCloudMonitoringMetricsLogger> | null} */
let logger = null;
let enabled = false;

function strLabel(v) {
  if (v == null || v === "") return "unknown";
  return String(v).slice(0, 256);
}

/**
 * Инициализация записи метрик в Yandex Cloud Monitoring (custom).
 * Нужны статические ключи сервисного аккаунта + ID каталога.
 * https://cloud.yandex.ru/docs/monitoring/operations/metric/add
 */
export function initYcMonitoring() {
  const folderId = process.env.YC_FOLDER_ID?.trim();
  const saId = process.env.YC_SERVICE_ACCOUNT_ID?.trim();
  const keyId = process.env.YC_ACCESS_KEY_ID?.trim();
  let privateKey = process.env.YC_PRIVATE_KEY?.trim();
  if (!folderId || !saId || !keyId || !privateKey) {
    return false;
  }
  if (!privateKey.includes("\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  try {
    logger = new YandexCloudMonitoringMetricsLogger(saId, keyId, privateKey, folderId);
    enabled = true;
    console.log(
      JSON.stringify({
        level: "info",
        event: "yc.monitoring.ready",
        timestamp: new Date().toISOString(),
      }),
    );
    return true;
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "yc.monitoring.init_failed",
        message: e?.message ?? String(e),
        timestamp: new Date().toISOString(),
      }),
    );
    return false;
  }
}

export function isYcMonitoringEnabled() {
  return enabled;
}

function baseLabels() {
  return {
    environment: strLabel(process.env.YC_DEPLOY_ENV || process.env.NODE_ENV || "development"),
    service: "auth-api",
  };
}

async function writeMetric(name, type, value, labels = {}) {
  if (!logger) return;
  const merged = { ...baseLabels(), ...labels };
  const stringLabels = {};
  for (const [k, v] of Object.entries(merged)) {
    stringLabels[k] = strLabel(v);
  }
  const result = await logger.writeMetrics({
    metrics: [{ name, type, value, labels: stringLabels }],
  });
  if (result?.error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "yc.monitoring.write_failed",
        error: result.error,
        metric: name,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

/** Серверная ошибка API (исключение в обработчике). */
export async function reportServerErrorMetric(fields = {}) {
  await writeMetric("saas.auth_api.error", YandexMetricType.DGAUGE, 1, {
    route: strLabel(fields.route ?? "unknown"),
    ...(fields.tags?.area ? { area: strLabel(fields.tags.area) } : {}),
  });
}

/** Ошибка, принятая с фронта через /api/monitoring/ingest (без секретов SA в браузере). */
export async function reportFrontendErrorMetric(fields = {}) {
  await writeMetric("saas.frontend.error", YandexMetricType.DGAUGE, 1, {
    route: strLabel(fields.route ?? "unknown"),
    ...(fields.tags?.area ? { area: strLabel(fields.tags.area) } : {}),
    ...(fields.tags?.action ? { action: strLabel(fields.tags.action) } : {}),
  });
}

/** Бизнес-событие (счётчик импульсов; в дашборде можно суммировать / группировать по labels). */
export async function reportBusinessEventMetric(eventName, fields = {}) {
  const labels = {
    ...(fields.plan ? { plan: strLabel(fields.plan) } : {}),
    ...(fields.paymentId ? { payment_id: strLabel(fields.paymentId) } : {}),
  };
  await writeMetric(`saas.business.${eventName}`, YandexMetricType.DGAUGE, 1, labels);
}
