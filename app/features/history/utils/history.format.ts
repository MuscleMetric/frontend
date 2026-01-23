// app/features/history/utils/history.format.ts

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function fmtMins(sec?: number | null) {
  if (sec == null || !isFinite(sec)) return null;
  return `${Math.max(1, Math.round(sec / 60))}m`;
}

export function fmtKg(n?: number | null, dp = 0) {
  if (n == null || !isFinite(n)) return "—";
  return `${n.toFixed(dp)}kg`;
}

export function fmtNumber(n?: number | null, dp = 0) {
  if (n == null || !isFinite(n)) return "—";
  return n.toFixed(dp);
}

export function fmtPct(n?: number | null, dp = 0) {
  if (n == null || !isFinite(n)) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(dp)}%`;
}

export function fmtDateDayMonth(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function fmtDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDaysLocal(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
