export function n1(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export function n0(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-GB");
}

export function formatKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}kg`;
}

export function formatVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("en-GB")}kg`;
}

export function shortLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;

  return d.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}