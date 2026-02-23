// app/features/social/create/shared/formatters.ts

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "--:--";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return value.toLocaleString();
}

export function formatDateShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}