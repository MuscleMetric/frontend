// app/features/workouts/live/review/useReviewData.ts
import { useMemo } from "react";
import type { LiveWorkoutDraft } from "../live/state/types";
import * as S from "../live/state/selectors";
import type { ReviewVM, ReviewExerciseVM, ReviewIssue, ReviewSetRow } from "./reviewTypes";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDuration(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

function fmtK(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function toNumOrNull(v: any): number | null {
  if (v === "" || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function deriveTimerSeconds(d: LiveWorkoutDraft) {
  // In LiveWorkoutScreen you derive it by adding “since last active”.
  // For review, we want stable: use committed elapsedSeconds only.
  // If you prefer “live” duration, swap to your timerSecondsFromDraft logic.
  return Math.max(0, Number(d.timerElapsedSeconds ?? 0));
}

function isCardio(ex: any) {
  return String(ex.type ?? "").toLowerCase() === "cardio";
}

function setIsCompletedEnough(ex: any, s: any) {
  if (isCardio(ex)) {
    const timeSeconds = toNumOrNull(s.timeSeconds);
    const distance = toNumOrNull(s.distance);
    return timeSeconds !== null || distance !== null;
  }
  // Strength rule per you: include if reps is not null (but must be numeric)
  const reps = toNumOrNull(s.reps);
  return reps !== null;
}

function setMissingLabel(ex: any, s: any) {
  if (isCardio(ex)) {
    const timeSeconds = toNumOrNull(s.timeSeconds);
    const distance = toNumOrNull(s.distance);
    if (timeSeconds === null && distance === null) return "Missing";
    return null;
  }
  const reps = toNumOrNull(s.reps);
  if (reps === null) return "Missing reps";
  const weight = toNumOrNull(s.weight);
  // treat null as “missing weight” (you will save as 0, but still helpful UX)
  if (weight === null) return "Missing weight";
  return null;
}

function calcStrengthVolumeKg(ex: any) {
  let vol = 0;
  for (const s of ex.sets ?? []) {
    const reps = toNumOrNull(s.reps);
    if (reps === null) continue;

    const weight = toNumOrNull(s.weight);
    const w = weight === null ? 0 : weight;
    vol += reps * w;
  }
  return vol;
}

function buildExerciseVM(ex: any, supersetLabels: Record<string, string>): ReviewExerciseVM {
  const cardio = isCardio(ex);

  const sets: ReviewSetRow[] = (ex.sets ?? []).map((s: any) => {
    const reps = cardio ? null : toNumOrNull(s.reps);
    const weight = cardio ? null : toNumOrNull(s.weight);
    const timeSeconds = cardio ? toNumOrNull(s.timeSeconds) : null;
    const distance = cardio ? toNumOrNull(s.distance) : null;

    const complete = setIsCompletedEnough(ex, s);

    return {
      setNumber: Number(s.setNumber ?? s.set_number ?? 0) || 0,
      dropIndex: Number(s.dropIndex ?? s.drop_index ?? 0) || 0,
      reps,
      weight,
      timeSeconds,
      distance,
      isCardio: cardio,
      isComplete: complete,
      missingLabel: complete ? null : setMissingLabel(ex, s),
    };
  });

  const completedSetsCount = sets.filter((x) => x.isComplete).length;

  const group = ex.prescription?.supersetGroup ?? null;
  const supersetLabel = group ? supersetLabels[group] ?? null : null;

  const missingWeightSetCount = cardio
    ? 0
    : (ex.sets ?? []).reduce((acc: number, s: any) => {
        const reps = toNumOrNull(s.reps);
        if (reps === null) return acc;
        const w = toNumOrNull(s.weight);
        if (w === null) return acc + 1;
        return acc;
      }, 0);

  const volumeKg = cardio ? 0 : calcStrengthVolumeKg(ex);

  return {
    id: String(ex.exerciseId ?? ex.exercise_id ?? ""),
    name: ex.name ?? "Exercise",
    type: ex.type ?? null,
    equipment: ex.equipment ?? null,
    orderIndex: Number(ex.orderIndex ?? ex.order_index ?? 0) || 0,
    supersetLabel,
    isDropset: Boolean(ex.prescription?.isDropset ?? false),
    sets,
    completedSetsCount,
    volumeKg,
    hasNoCompletedSets: completedSetsCount === 0,
    missingWeightSetCount,
  };
}

export function useReviewData(draft: LiveWorkoutDraft | null): ReviewVM | null {
  return useMemo(() => {
    if (!draft) return null;

    const supersetLabels = S.buildSupersetLabels(draft);

    const exercisesSorted = (draft.exercises ?? [])
      .slice()
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    const exerciseVMs = exercisesSorted.map((ex: any) => buildExerciseVM(ex, supersetLabels));

    const durationSeconds = deriveTimerSeconds(draft);
    const exercisesTotal = exerciseVMs.length;

    const exercisesWithCompletedSets = exerciseVMs.filter((e) => e.completedSetsCount > 0).length;
    const setsCompleted = exerciseVMs.reduce((acc, e) => acc + e.completedSetsCount, 0);
    const volumeKg = exerciseVMs.reduce((acc, e) => acc + e.volumeKg, 0);

    const issues: ReviewIssue[] = [];

    const missingWeightSets = exerciseVMs.reduce((acc, e) => acc + e.missingWeightSetCount, 0);
    if (missingWeightSets > 0) {
      issues.push({
        key: "missing_weight",
        title: "Some sets are missing weight",
        detail: `${missingWeightSets} set${missingWeightSets === 1 ? "" : "s"} have reps but no weight.`,
        severity: "warn",
      });
    }

    const noCompletedExercises = exerciseVMs.filter((e) => e.hasNoCompletedSets).length;
    if (noCompletedExercises > 0) {
      issues.push({
        key: "no_completed_sets",
        title: "Some exercises have no completed sets",
        detail: `${noCompletedExercises} exercise${noCompletedExercises === 1 ? "" : "s"} won’t be saved unless at least one set is filled.`,
        severity: "warn",
      });
    }

    const summary = {
      durationSeconds,
      durationText: formatDuration(durationSeconds),
      exercisesTotal,
      exercisesWithCompletedSets,
      setsCompleted,
      volumeKg,
      volumeText: fmtK(volumeKg),
    };

    return { summary, issues, exercises: exerciseVMs };
  }, [draft]);
}
