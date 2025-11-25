// utils/dates.ts
export function toISODateUTC(d: Date) {
  // format YYYY-MM-DD using local calendar values, no timezone conversion
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
