import type { Confidence, TrendDirection } from "../types";

export function calculateE1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;

  return weight * (1 + reps / 30);
}

export function calculateVolume(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;

  return weight * reps;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function stdev(values: number[]): number {
  const clean = values.filter(Number.isFinite);

  if (clean.length < 2) return 0;

  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;

  const variance =
    clean.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    (clean.length - 1);

  return Math.sqrt(variance);
}

export function calculatePercentChange(
  first: number | null | undefined,
  last: number | null | undefined,
): number | null {
  if (first == null || last == null) return null;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  if (first <= 0) return null;

  return ((last - first) / first) * 100;
}

export function calculateTrendDirection(values: number[]): TrendDirection {
  const clean = values.filter(Number.isFinite);

  if (clean.length < 3) return "flat";

  const first = clean[0];
  const last = clean[clean.length - 1];

  const change = calculatePercentChange(first, last);

  if (change == null) return "flat";

  if (change > 2) return "up";
  if (change < -2) return "down";

  return "flat";
}

export function calculateLinearSlope(values: number[]): number {
  const clean = values.filter(Number.isFinite);

  if (clean.length < 2) return 0;

  const n = clean.length;
  const xs = clean.map((_, index) => index);

  const xMean = xs.reduce((sum, x) => sum + x, 0) / n;
  const yMean = clean.reduce((sum, y) => sum + y, 0) / n;

  const numerator = clean.reduce((sum, y, index) => {
    return sum + (xs[index] - xMean) * (y - yMean);
  }, 0);

  const denominator = xs.reduce((sum, x) => {
    return sum + Math.pow(x - xMean, 2);
  }, 0);

  if (denominator === 0) return 0;

  return numerator / denominator;
}

export function confidenceFromSeries(
  series: { top_weight: number; top_e1rm: number }[],
): Confidence {
  const count = series.length;

  if (count < 3) return "low";
  if (count < 6) return "medium";

  const e1rms = series
    .map((point) => point.top_e1rm)
    .filter(Number.isFinite);

  const sd = stdev(e1rms);

  const mean =
    e1rms.length > 0
      ? e1rms.reduce((sum, value) => sum + value, 0) / e1rms.length
      : 0;

  const noise = mean > 0 ? sd / mean : 0;

  if (noise > 0.08) return "medium";

  return "high";
}

export function getRecentValues(values: number[], count = 6): number[] {
  return values.filter(Number.isFinite).slice(-count);
}

export function hasPlateaued(values: number[], windowSize = 4): boolean {
  const clean = values.filter(Number.isFinite);

  if (clean.length < windowSize + 1) return false;

  const recent = clean.slice(-windowSize);
  const previousBest = Math.max(...clean.slice(0, -windowSize));
  const recentBest = Math.max(...recent);

  return recentBest <= previousBest;
}

export function niceStep(value: number): number {
  if (value >= 200) return 10;
  if (value >= 100) return 5;
  if (value >= 50) return 2;
  return 1;
}

export function niceFloor(value: number): number {
  const step = niceStep(value);
  return Math.floor(value / step) * step;
}

export function niceCeil(value: number): number {
  const step = niceStep(value);
  return Math.ceil(value / step) * step;
}

export function ticks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (count <= 1) return [min];

  const step = (max - min) / (count - 1);

  return Array.from({ length: count }, (_, index) => min + step * index);
}