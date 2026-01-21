import type { ProgressOverview } from "./progress.types";

export function formatKg(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n)}kg`;
}

export function formatPct(p: number | null | undefined) {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p}%`;
}

export function relativeDayLabel(iso: string, locale = "en-GB") {
  // keep it simple for now; you can swap to your existing format helper if you have one
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

export function mapOverview(o: ProgressOverview) {
  // In future we can do: copy variations, derived badges, CTA decisions, etc.
  return {
    meta: o.meta,
    momentum: o.momentum,
    consistency: o.consistency,
    highlights: o.highlights,
    exerciseSummary: o.exercise_summary,
    recent: o.recent_activity,
  };
}
