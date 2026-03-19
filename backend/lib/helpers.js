// ── helpers ──────────────────────────────────────────────────────
export function throwOnError({ data, error }) {
  if (error) throw error;
  return data;
}
