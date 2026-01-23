// app/features/history/utils/history.insights.ts

import type { HistoryInsight } from "../data/history.types";
import { fmtPct } from "./history.format";

export type InsightUI = {
  tone: "success" | "danger" | "neutral";
  icon: "trending-up" | "trending-down" | "remove";
  label: string;
};

export function insightToUI(insight?: HistoryInsight): InsightUI | null {
  if (!insight) return null;

  const trend = insight.trend;
  const tone = trend === "up" ? "success" : trend === "down" ? "danger" : "neutral";
  const icon = trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : "remove";

  return {
    tone,
    icon,
    label: insight.label,
  };
}

/**
 * Optional: if backend only gives delta_pct and not label, we can build one.
 * (Use only if you decide to simplify backend later.)
 */
export function buildVolumeInsight(deltaPct?: number | null): HistoryInsight {
  if (deltaPct == null || !isFinite(deltaPct)) return null;

  const abs = Math.abs(deltaPct);
  const trend = deltaPct > 0.25 ? "up" : deltaPct < -0.25 ? "down" : "flat";
  const pct = fmtPct(deltaPct, abs < 10 ? 1 : 0) ?? "0%";

  const label =
    trend === "up"
      ? `Lifted ${pct} more than last time`
      : trend === "down"
      ? `Lifted ${pct.replace("-", "")}% less than last time`
      : "Matched your last session";

  return { metric: "volume", trend, delta_pct: deltaPct, label };
}
