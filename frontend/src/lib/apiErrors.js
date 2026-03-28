import { ApiError } from "../../../backend/lib/errors.js";

/** HTTP-статус из ApiError или согласованного code (для редиректа / баннера). */
export function getHttpStatus(err) {
  if (err == null) return undefined;
  if (typeof err.status === "number" && Number.isFinite(err.status)) return err.status;
  const c = err.code;
  if (c === "auth_required" || c === "auth_failed") return 401;
  if (c === "forbidden" || c === "not_found" || c === "no_access") return 403;
  return undefined;
}

export function isUnauthorizedError(err) {
  return getHttpStatus(err) === 401;
}

export function isForbiddenError(err) {
  return getHttpStatus(err) === 403;
}

export function isApiErrorInstance(err) {
  return err instanceof ApiError || err?.name === "ApiError";
}
