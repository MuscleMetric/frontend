// app/features/social/feed/utils/format.ts

export function fmtTs(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;

  // dd/mm/yyyy hh:mm (matches what you had)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export function toNumber(v: number | string | null | undefined) {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 8450 -> "8,450"
 */
export function fmtInt(n: number) {
  try {
    return Math.round(n).toLocaleString();
  } catch {
    return String(Math.round(n));
  }
}

/**
 * Volume is computed in SQL as sum(weight*reps) so it's already total "kg-reps" volume.
 * We'll format as int with separators.
 */
export function fmtVolume(v: number | string) {
  return fmtInt(toNumber(v));
}