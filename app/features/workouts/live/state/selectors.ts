import type {
  LiveWorkoutDraft,
  LiveExerciseDraft,
  LiveSetDraft,
} from "./types";

/** What counts as "entered data" for a set */
export function hasSetData(ex: LiveExerciseDraft, s: LiveSetDraft): boolean {
  const type = (ex.type ?? "").toLowerCase();

  if (type === "cardio") {
    return (
      (s.distance != null && s.distance > 0) ||
      (s.timeSeconds != null && s.timeSeconds > 0)
    );
  }

  // strength default
  return (s.reps != null && s.reps > 0) || (s.weight != null && s.weight > 0);
}

export function isExerciseComplete(ex: LiveExerciseDraft): boolean {
  if (!ex.sets?.length) return false;
  return ex.sets.every((s) => hasSetData(ex, s));
}

export function isExerciseStarted(ex: LiveExerciseDraft): boolean {
  if (!ex.sets?.length) return false;
  return ex.sets.some((s) => hasSetData(ex, s));
}

export function getProgress(draft: LiveWorkoutDraft) {
  const total = draft.exercises.length;
  const done = draft.exercises.filter(isExerciseComplete).length;
  const started = draft.exercises.filter(isExerciseStarted).length;
  return { total, done, started };
}

export function canCompleteWorkout(draft: LiveWorkoutDraft): boolean {
  return draft.exercises.some(isExerciseStarted);
}

export function getActiveExercise(draft: LiveWorkoutDraft) {
  const idx = Math.max(
    0,
    Math.min(draft.ui.activeExerciseIndex, draft.exercises.length - 1)
  );
  return { index: idx, exercise: draft.exercises[idx] };
}

/** Next set user should do (first set without data). Defaults to 1. */
export function getNextSetNumber(ex: LiveExerciseDraft): number {
  const firstIncomplete = ex.sets.find((s) => !hasSetData(ex, s));
  return (
    firstIncomplete?.setNumber ?? ex.sets[ex.sets.length - 1]?.setNumber ?? 1
  );
}

function fmtNum(n: number, dp = 0) {
  const f = dp === 0 ? Math.round(n).toString() : n.toFixed(dp);
  return f;
}

/** Label from last session sets (best effort). */
export function getLastSessionLabel(ex: LiveExerciseDraft): string | null {
  const type = (ex.type ?? "").toLowerCase();
  const sets = ex.lastSession?.sets ?? [];
  if (!sets.length) return null;

  // pick the "most meaningful" set: last set that has any data
  const last = [...sets].reverse().find((s) => {
    if (type === "cardio")
      return (s.distance ?? 0) > 0 || (s.timeSeconds ?? 0) > 0;
    return (s.reps ?? 0) > 0 || (s.weight ?? 0) > 0;
  });
  if (!last) return null;

  if (type === "cardio") {
    const parts: string[] = [];
    if (last.distance != null) parts.push(`${fmtNum(last.distance, 2)}km`);
    if (last.timeSeconds != null) parts.push(`${fmtNum(last.timeSeconds)}s`);
    return parts.length ? parts.join(" • ") : null;
  }

  const r = last.reps ?? 0;
  const w = last.weight ?? 0;
  if (!r && !w) return null;
  if (r && w) return `${r}×${fmtNum(w)}kg`;
  if (r) return `${r} reps`;
  return `${fmtNum(w)}kg`;
}

/** Label from current workout (today) based on latest entered set. */
export function getTodayLastEnteredLabel(ex: LiveExerciseDraft): string | null {
  const type = (ex.type ?? "").toLowerCase();
  const sets = ex.sets ?? [];
  if (!sets.length) return null;

  const last = [...sets].reverse().find((s) => hasSetData(ex, s));
  if (!last) return null;

  if (type === "cardio") {
    const parts: string[] = [];
    if (last.distance != null) parts.push(`${fmtNum(last.distance, 2)}km`);
    if (last.timeSeconds != null) parts.push(`${fmtNum(last.timeSeconds)}s`);
    return parts.length ? parts.join(" • ") : null;
  }

  const r = last.reps ?? 0;
  const w = last.weight ?? 0;
  if (!r && !w) return null;
  if (r && w) return `${r}×${fmtNum(w)}kg`;
  if (r) return `${r} reps`;
  return `${fmtNum(w)}kg`;
}

/** Superset label mapping: A, B, C... for groups that exist */
export function buildSupersetLabels(
  draft: LiveWorkoutDraft
): Record<string, string> {
  const groups = Array.from(
    new Set(
      draft.exercises
        .map((e) => e.prescription?.supersetGroup)
        .filter((g): g is string => !!g && g.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const out: Record<string, string> = {};
  groups.forEach((g, i) => {
    const letter = String.fromCharCode("A".charCodeAt(0) + (i % 26));
    out[g] = `Superset ${letter}`;
  });
  return out;
}

/** Row CTA label */
export function getExerciseCtaLabel(
  ex: LiveExerciseDraft
): "Start" | "Continue" | "Done ✓ Edit" {
  const complete = isExerciseComplete(ex);
  if (complete) return "Done ✓ Edit";
  if (isExerciseStarted(ex)) return "Continue";
  return "Start";
}

/** e.g. "4 sets × 12 • 7.5kg" (best effort from prescription) */
export function getPrescriptionSummary(ex: LiveExerciseDraft): string {
  const p = ex.prescription;
  if (!p) return `${ex.sets.length} sets`;

  const parts: string[] = [];
  if (p.targetSets != null) parts.push(`${p.targetSets} sets`);
  else parts.push(`${ex.sets.length} sets`);

  if (p.targetReps != null) parts.push(`× ${p.targetReps}`);

  const dots: string[] = [];
  if (p.targetWeight != null) dots.push(`${fmtNum(p.targetWeight)}kg`);
  if (p.targetTimeSeconds != null) dots.push(`${fmtNum(p.targetTimeSeconds)}s`);
  if (p.targetDistance != null) dots.push(`${fmtNum(p.targetDistance, 2)}km`);

  return parts.join(" ") + (dots.length ? ` • ${dots.join(" • ")}` : "");
}

/** lines shown inside completed row: "1. 12 reps × 7.5kg" */
export function getCompletedSetLines(ex: LiveExerciseDraft): string[] {
  const type = (ex.type ?? "").toLowerCase();
  const sets = ex.sets ?? [];
  return sets
    .filter((s) => hasSetData(ex, s))
    .map((s) => {
      if (type === "cardio") {
        const bits: string[] = [];
        if (s.distance != null) bits.push(`${fmtNum(s.distance, 2)}km`);
        if (s.timeSeconds != null) bits.push(`${fmtNum(s.timeSeconds)}s`);
        return `${s.setNumber}. ${bits.join(" • ") || "—"}`;
      }
      const reps = s.reps != null ? `${s.reps} reps` : "— reps";
      const w = s.weight != null ? ` × ${fmtNum(s.weight)}kg` : "";
      return `${s.setNumber}. ${reps}${w}`;
    });
}

/** For the right-side pill */
export function getRowPillLabel(
  ex: LiveExerciseDraft
): "Start" | "Continue" | "Done ✓ Edit" {
  if (isExerciseComplete(ex)) return "Done ✓ Edit";
  if (isExerciseStarted(ex)) return "Continue";
  return "Start";
}

/** Small tags for row display */
export function getRowTags(
  ex: LiveExerciseDraft,
  supersetLabels: Record<string, string>
): string[] {
  const tags: string[] = [];
  const g = ex.prescription?.supersetGroup;
  if (g && supersetLabels[g]) tags.push(supersetLabels[g]);
  if (ex.prescription?.isDropset) tags.push("Dropset");
  return tags;
}
