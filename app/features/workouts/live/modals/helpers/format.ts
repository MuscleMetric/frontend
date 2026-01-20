// live/modals/helpers/format.ts
export function fmtKg(n: number) {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}kg`;
}

export function fmtNum(n: number, dp = 0) {
  if (dp === 0) return `${Math.round(n)}`;
  return n.toFixed(dp);
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}:${mm}`;
}
