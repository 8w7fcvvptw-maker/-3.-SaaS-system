export function isPositiveInteger(input) {
  if (!input) return false;
  const value = Number(input);
  return Number.isInteger(value) && value > 0;
}

export function isValidTaskDescription(input) {
  return typeof input === "string" && input.trim().length >= 10;
}

export function isValidContact(input) {
  if (typeof input !== "string") return false;
  const trimmed = input.trim();
  if (trimmed.length < 5 || trimmed.length > 120) return false;
  const simpleContactRegex = /^[\w@+().,\-:\s]+$/u;
  return simpleContactRegex.test(trimmed);
}
