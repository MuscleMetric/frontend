// app/features/workouts/live/state/selectors.ts
import type { LiveWorkoutDraft } from "../../../workouts/hooks/liveWorkoutTypes";

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function getActiveExerciseIndex(draft: LiveWorkoutDraft) {
  return clamp(draft.ui.activeExerciseIndex, 0, Math.max(0, draft.exercises.length - 1));
}

export function getActiveExercise(draft: LiveWorkoutDraft) {
  return draft.exercises[getActiveExerciseIndex(draft)] ?? null;
}

export function getProgress(draft: LiveWorkoutDraft) {
  const total = draft.exercises.length;
  const done = draft.exercises.filter((e) => e.isDone).length;
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

export function findNextExerciseIndex(draft: LiveWorkoutDraft, fromIndex: number) {
  for (let i = fromIndex + 1; i < draft.exercises.length; i++) {
    if (!draft.exercises[i]?.isDone) return i;
  }
  // loop once (optional)
  for (let i = 0; i < fromIndex; i++) {
    if (!draft.exercises[i]?.isDone) return i;
  }
  return null;
}

export function isSupersetExercise(ex: any) {
  // your draft exercise shape already includes prescription in bootstrap;
  // in live draft you may store flags. For now: treat as superset if group exists
  return !!ex?.prescription?.supersetGroup;
}

export function isDropsetExercise(ex: any) {
  return !!ex?.prescription?.isDropset;
}
