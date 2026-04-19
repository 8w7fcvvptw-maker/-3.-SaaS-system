/**
 * Яндекс Cloud Monitoring: JWT → IAM (REST) → запись пользовательских метрик (REST).
 * Формат тела и query: https://cloud.yandex.ru/docs/monitoring/api-ref/MetricsData/write
 */
import jwt from "jsonwebtoken";

const IAM_TOKEN_URL = "https://iam.api.cloud.yandex.net/iam/v1/tokens";
const MONITORING_WRITE_URL = "https://monitoring.api.cloud.yandex.net/monitoring/v2/data/write";

/** Совместимость с прежним кодом observability.mjs */
export const YandexMetricType = {
  DGAUGE: "DGAUGE",
  GAUGE: "GAUGE",
  COUNTER: "COUNTER",
  RATE: "RATE",
};

let folderIdStr = null;
let serviceAccountIdStr = null;
let accessKeyIdStr = null;
let privateKeyPem = null;
let enabled = false;

let iamCache = { token: null, expiresAt: 0 };

function strLabel(v) {
  if (v == null || v === "") return "unknown";
  return String(v).slice(0, 256);
}

function loadPrivateKeyFromEnv() {
  const b64 = process.env.YC_PRIVATE_KEY_BASE64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      if (decoded.includes("BEGIN")) return decoded;
    } catch {
      return null;
    }
  }
  let pem = process.env.YC_PRIVATE_KEY?.trim();
  if (!pem) return null;
  if (!pem.includes("\n")) {
    pem = pem.replace(/\\n/g, "\n");
  }
  return pem;
}

export function initYcMonitoring() {
  folderIdStr = process.env.YC_FOLDER_ID?.trim();
  serviceAccountIdStr = process.env.YC_SERVICE_ACCOUNT_ID?.trim();
  accessKeyIdStr = process.env.YC_ACCESS_KEY_ID?.trim();
  privateKeyPem = loadPrivateKeyFromEnv();

  if (!folderIdStr || !serviceAccountIdStr || !accessKeyIdStr || !privateKeyPem) {
    console.log(
      JSON.stringify({
        level: "info",
        event: "yc.monitoring.disabled",
        reason: "missing_env",
        hasFolder: !!folderIdStr,
        hasServiceAccountId: !!serviceAccountIdStr,
        hasAccessKeyId: !!accessKeyIdStr,
        hasPrivateKey: !!privateKeyPem,
        timestamp: new Date().toISOString(),
      }),
    );
    enabled = false;
    return false;
  }

  if (!privateKeyPem.includes("BEGIN")) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "yc.monitoring.init_failed",
        message:
          "YC_PRIVATE_KEY не похож на PEM. Нужны строки -----BEGIN PRIVATE KEY-----. Либо используйте YC_PRIVATE_KEY_BASE64.",
        timestamp: new Date().toISOString(),
      }),
    );
    enabled = false;
    return false;
  }

  enabled = true;
  console.log(
    JSON.stringify({
      level: "info",
      event: "yc.monitoring.ready",
      folderIdPrefix: `${folderIdStr.slice(0, 8)}…`,
      timestamp: new Date().toISOString(),
    }),
  );
  return true;
}

export function isYcMonitoringEnabled() {
  return enabled;
}

function invalidateIamCache() {
  iamCache.token = null;
  iamCache.expiresAt = 0;
}

async function exchangeJwtForIamToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountIdStr,
    aud: "https://iam.api.cloud.yandex.net/iam/v1/tokens",
    iat: now,
    exp: now + 3600,
  };
  const signed = jwt.sign(payload, privateKeyPem, {
    algorithm: "PS256",
    keyid: accessKeyIdStr,
  });

  const res = await fetch(IAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jwt: signed }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`IAM ${res.status}: ${text.slice(0, 600)}`);
    err.detail = data;
    throw err;
  }
  if (!data.iamToken) {
    throw new Error(`Ответ IAM без iamToken: ${text.slice(0, 400)}`);
  }
  return data.iamToken;
}

async function getIamTokenCached() {
  if (iamCache.token && Date.now() < iamCache.expiresAt - 120_000) {
    return iamCache.token;
  }
  const token = await exchangeJwtForIamToken();
  iamCache.token = token;
  iamCache.expiresAt = Date.now() + 3500 * 1000;
  return token;
}

async function postMonitoringWrite(bodyObject) {
  const iamToken = await getIamTokenCached();
  const url = `${MONITORING_WRITE_URL}?folderId=${encodeURIComponent(folderIdStr)}&service=custom`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${iamToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(bodyObject),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (res.status === 401) {
    invalidateIamCache();
    const err = new Error(`Monitoring 401 (обновите IAM): ${text.slice(0, 400)}`);
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`Monitoring HTTP ${res.status}: ${text.slice(0, 800)}`);
    err.detail = data;
    throw err;
  }

  if (data.errorMessage) {
    const err = new Error(data.errorMessage || "Monitoring вернул errorMessage");
    err.detail = data;
    throw err;
  }

  return data;
}

async function writeMonitoringOnce(bodyObject) {
  try {
    return await postMonitoringWrite(bodyObject);
  } catch (e) {
    if (e?.status === 401) {
      return postMonitoringWrite(bodyObject);
    }
    throw e;
  }
}

async function writeMetricInternal(name, metricType, value, labels = {}) {
  const ts = new Date().toISOString();
  const stringLabels = {};
  for (const [k, v] of Object.entries(labels)) {
    stringLabels[k] = strLabel(v);
  }

  const body = {
    ts,
    metrics: [
      {
        name,
        labels: stringLabels,
        type: metricType,
        value,
      },
    ],
  };

  return writeMonitoringOnce(body);
}

export async function writeMetric(name, type, value, labels = {}) {
  if (!enabled) return;
  const ts = new Date().toISOString();
  try {
    const data = await writeMetricInternal(name, type, value, labels);
    if (process.env.YC_MONITORING_DEBUG === "1") {
      console.log(
        JSON.stringify({
          level: "info",
          event: "yc.monitoring.write_ok",
          metric: name,
          response: data,
          timestamp: ts,
        }),
      );
    }
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "yc.monitoring.write_failed",
        metric: name,
        message: e?.message ?? String(e),
        timestamp: ts,
      }),
    );
    invalidateIamCache();
  }
}

function baseLabels() {
  return {
    environment: strLabel(process.env.YC_DEPLOY_ENV || process.env.NODE_ENV || "development"),
    service: "auth-api",
  };
}

export async function reportServerErrorMetric(fields = {}) {
  await writeMetric("saas.auth_api.error", YandexMetricType.DGAUGE, 1, {
    ...baseLabels(),
    route: strLabel(fields.route ?? "unknown"),
    ...(fields.tags?.area ? { area: strLabel(fields.tags.area) } : {}),
  });
}

export async function reportFrontendErrorMetric(fields = {}) {
  await writeMetric("saas.frontend.error", YandexMetricType.DGAUGE, 1, {
    ...baseLabels(),
    route: strLabel(fields.route ?? "unknown"),
    ...(fields.tags?.area ? { area: strLabel(fields.tags.area) } : {}),
    ...(fields.tags?.action ? { action: strLabel(fields.tags.action) } : {}),
  });
}

export async function reportBusinessEventMetric(eventName, fields = {}) {
  const labels = {
    ...baseLabels(),
    ...(fields.plan ? { plan: strLabel(fields.plan) } : {}),
    ...(fields.paymentId ? { payment_id: strLabel(fields.paymentId) } : {}),
  };
  await writeMetric(`saas.business.${eventName}`, YandexMetricType.DGAUGE, 1, labels);
}

/**
 * Проверка цепочки JWT → IAM → запись (для POST /api/monitoring/self-test).
 */
export async function runMonitoringSelfTest() {
  if (!enabled) {
    return {
      ok: false,
      step: "config",
      message:
        "Метрики выключены: проверьте YC_FOLDER_ID, YC_SERVICE_ACCOUNT_ID, YC_ACCESS_KEY_ID, YC_PRIVATE_KEY (или YC_PRIVATE_KEY_BASE64).",
    };
  }
  try {
    await exchangeJwtForIamToken();
  } catch (e) {
    return {
      ok: false,
      step: "iam",
      message: e?.message ?? String(e),
    };
  }

  invalidateIamCache();

  try {
    const ts = new Date().toISOString();
    await writeMetricInternal("saas.self_test.ping", YandexMetricType.DGAUGE, 1, {
      ...baseLabels(),
      check: "manual",
    });
    return {
      ok: true,
      step: "write",
      message:
        "Запрос принят. В консоли Monitoring откройте каталог → Метрики → Сервис custom → фильтр saas.self_test.ping (данные могут появиться с задержкой 1–3 мин).",
      timestamp: ts,
    };
  } catch (e) {
    return {
      ok: false,
      step: "write",
      message: e?.message ?? String(e),
    };
  }
}
