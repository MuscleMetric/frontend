// app/features/workouts/live/session/time.ts

import type { ActiveWorkoutSnapshot } from "./types";

export function nowIso() {
  return new Date().toISOString();
}

export function secondsBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.floor((b - a) / 1000));
}

export function timerSecondsFromSnapshot(d: ActiveWorkoutSnapshot) {
  const base = Number(d.timerElapsedSeconds ?? 0);
  const last = d.timerLastActiveAt;
  if (!last) return base;
  return base + secondsBetween(last, nowIso());
}

export function timerTextFromSeconds(totalSeconds: number) {
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;

  if (hh > 0) {
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}