// live/modals/helpers/strengthMath.ts
import type { LiveExerciseDraft } from "../../state/types";
import { hasSetData } from "../../state/selectors";

export function e1rm(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

export function computeSessionVolume(ex: LiveExerciseDraft) {
  let total = 0;
  for (const s of ex.sets) {
    if (!hasSetData(ex, s)) continue;
    const reps = s.reps ?? 0;
    const w = s.weight ?? 0;
    total += reps * w;
  }
  return total;
}

export function bestSetByE1rm(ex: LiveExerciseDraft) {
  let best:
    | { setNumber: number; weight: number; reps: number; est: number }
    | null = null;

  for (const s of ex.sets) {
    const reps = s.reps ?? null;
    const w = s.weight ?? null;
    if (!reps || !w) continue;
    if (reps <= 0 || w <= 0) continue;

    const est = e1rm(w, reps);
    if (!best || est > best.est) best = { setNumber: s.setNumber, weight: w, reps, est };
  }

  return best;
}

export function est1rm(weight: number | null, reps: number | null) {
  if (weight == null || reps == null) return null;
  if (weight <= 0 || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

export function scoreStrengthSet(s: { weight: number | null; reps: number | null }) {
  return est1rm(s.weight, s.reps) ?? -1;
}

export function pickBestStrengthSource(args: {
  prevSet: { weight: number | null; reps: number | null } | null;
  lastSet: { weight: number | null; reps: number | null } | null;
}) {
  const prevScore = args.prevSet ? scoreStrengthSet(args.prevSet) : -1;
  const lastScore = args.lastSet ? scoreStrengthSet(args.lastSet) : -1;
  if (prevScore < 0 && lastScore < 0) return null;
  return prevScore >= lastScore ? args.prevSet : args.lastSet;
}
