// live/modals/helpers/cardio.ts
export function parseNullableNumber(s: string) {
  if (!s) return null;
  if (s === "." || s === "0" || s === "0.") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}
