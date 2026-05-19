import type {
  DeepAnalyticsInsight,
  DeepAnalyticsPayload,
} from "../types";

import {
  calculatePercentChange,
  calculateTrendDirection,
  confidenceFromSeries,
  hasPlateaued,
} from "./deepAnalyticsMath";

import { formatKg, formatPercent, formatVolume } from "./deepAnalyticsFormat";

function getProgressSeries(payload: DeepAnalyticsPayload) {
  return payload.charts.progress_over_time ?? [];
}

function getE1RMValues(payload: DeepAnalyticsPayload): number[] {
  return getProgressSeries(payload)
    .map((point) => point.top_e1rm)
    .filter(Number.isFinite);
}

function getVolumeValues(payload: DeepAnalyticsPayload): number[] {
  return payload.charts.volume_trend
    .map((point) => point.volume)
    .filter(Number.isFinite);
}

export function generatePrimaryInsight(
  payload: DeepAnalyticsPayload,
): DeepAnalyticsInsight {
  const exerciseName = payload.meta.exercise_name;
  const series = getProgressSeries(payload);
  const e1rms = getE1RMValues(payload);

  if (e1rms.length < 3) {
    return {
      type: "not_enough_data",
      title: "More sessions needed",
      description: `Log a few more ${exerciseName} sessions before MuscleMetric can give a reliable trend.`,
      confidence: "low",
    };
  }

  const first = e1rms[0];
  const last = e1rms[e1rms.length - 1];
  const change = calculatePercentChange(first, last);
  const trend = calculateTrendDirection(e1rms);
  const confidence = confidenceFromSeries(series);

  if (hasPlateaued(e1rms, 4)) {
    return {
      type: "plateau",
      title: "Progress has slowed",
      description: `Your ${exerciseName} estimated strength has not beaten its previous best across the recent sessions.`,
      confidence,
    };
  }

  if (trend === "up") {
    return {
      type: "improving",
      title: "Strength is improving",
      description:
        change == null
          ? `${exerciseName} is trending upward across your recent sessions.`
          : `${exerciseName} estimated strength is up ${formatPercent(
              change,
            )} across this trend.`,
      confidence,
    };
  }

  if (trend === "down") {
    return {
      type: "regressing",
      title: "Strength is dipping",
      description:
        change == null
          ? `${exerciseName} has trended down recently.`
          : `${exerciseName} estimated strength is down ${formatPercent(
              Math.abs(change),
            )} across this trend.`,
      confidence,
    };
  }

  return {
    type: "stable",
    title: "Strength is stable",
    description: `${exerciseName} performance has stayed fairly consistent recently.`,
    confidence,
  };
}

export function generateVolumeInsight(
  payload: DeepAnalyticsPayload,
): DeepAnalyticsInsight | null {
  const values = getVolumeValues(payload);

  if (values.length < 3) return null;

  const first = values[0];
  const last = values[values.length - 1];
  const change = calculatePercentChange(first, last);

  if (change == null) return null;

  if (change > 10) {
    return {
      type: "volume_up",
      title: "Volume is building",
      description: `Recent volume is up ${formatPercent(
        change,
      )}, from ${formatVolume(first)} to ${formatVolume(last)}.`,
      confidence: values.length >= 6 ? "high" : "medium",
    };
  }

  if (change < -10) {
    return {
      type: "volume_down",
      title: "Volume has dropped",
      description: `Recent volume is down ${formatPercent(
        Math.abs(change),
      )}, from ${formatVolume(first)} to ${formatVolume(last)}.`,
      confidence: values.length >= 6 ? "high" : "medium",
    };
  }

  return {
    type: "stable",
    title: "Volume is stable",
    description: "Recent training volume has stayed fairly consistent.",
    confidence: values.length >= 6 ? "high" : "medium",
  };
}

export function generateStatSummary(payload: DeepAnalyticsPayload) {
  const current = payload.cards.current;
  const bestSet = payload.cards.best_set;
  const currentE1RM = current?.top_set?.e1rm ?? null;
  const bestE1RM = bestSet?.e1rm ?? null;

  return {
    currentTopWeight: current?.top_weight ?? null,
    currentTopSet:
      current?.top_set == null
        ? "—"
        : `${formatKg(current.top_set.weight_kg)} × ${current.top_set.reps}`,
    currentE1RM,
    bestSet:
      bestSet == null
        ? "—"
        : `${formatKg(bestSet.weight_kg)} × ${bestSet.reps}`,
    bestE1RM,
  };
}