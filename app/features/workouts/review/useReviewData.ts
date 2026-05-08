import { useMemo } from "react";
import type { LiveWorkoutDraft } from "../live/state/types";
import * as S from "../live/state/selectors";
import type {
  ReviewVM,
  ReviewExerciseVM,
  ReviewIssue,
  ReviewSetRow,
} from "./reviewTypes";
import {
  getExerciseLoggingProfile,
  hasCompletedSet,
} from "../logging/exerciseLoggingProfile";

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

function secondsBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.floor((b - a) / 1000));
}

function deriveTimerSeconds(d: LiveWorkoutDraft) {
  const base = Math.max(0, Number(d.timerElapsedSeconds ?? 0));
  const anchor = d.timerLastActiveAt;
  if (!anchor) return base;

  return base + secondsBetween(anchor, new Date().toISOString());
}

function setMissingLabel(profile: ReturnType<typeof getExerciseLoggingProfile>, s: any) {
  if (profile.supportsTime && toNumOrNull(s.timeSeconds) === null) {
    return "Missing time";
  }

  if (profile.supportsDistance && toNumOrNull(s.distance) === null) {
    return "Missing distance";
  }

  if (profile.supportsReps && toNumOrNull(s.reps) === null) {
    return "Missing reps";
  }

  if (
    profile.loggingType === "strength" &&
    profile.supportsWeight &&
    toNumOrNull(s.weight) === null
  ) {
    return "Missing weight";
  }

  return null;
}

function calcVolumeKg(ex: any, profile: ReturnType<typeof getExerciseLoggingProfile>) {
  if (!profile.canComputeVolume) return 0;

  let vol = 0;

  for (const s of ex.sets ?? []) {
    const reps = toNumOrNull(s.reps);
    if (reps === null) continue;

    const weight = toNumOrNull(s.weight);
    if (weight === null) continue;

    vol += reps * weight;
  }

  return vol;
}

function buildExerciseVM(
  ex: any,
  supersetLabels: Record<string, string>,
): ReviewExerciseVM {
  const profile = getExerciseLoggingProfile(ex);
  const loggingType = profile.loggingType;

  const sets: ReviewSetRow[] = (ex.sets ?? []).map((s: any) => {
    const reps = profile.supportsReps ? toNumOrNull(s.reps) : null;
    const weight = profile.supportsWeight ? toNumOrNull(s.weight) : null;
    const timeSeconds = profile.supportsTime ? toNumOrNull(s.timeSeconds) : null;
    const distance = profile.supportsDistance ? toNumOrNull(s.distance) : null;

    const complete = hasCompletedSet(profile, {
      reps,
      weight,
      timeSeconds,
      distance,
    });

    return {
      setNumber: Number(s.setNumber ?? s.set_number ?? 0) || 0,
      dropIndex: Number(s.dropIndex ?? s.drop_index ?? 0) || 0,
      reps,
      weight,
      timeSeconds,
      distance,
      isCardio: loggingType === "cardio",
      isComplete: complete,
      missingLabel: complete ? null : setMissingLabel(profile, s),
    };
  });

  const completedSetsCount = sets.filter((x) => x.isComplete).length;

  const group = ex.prescription?.supersetGroup ?? null;
  const supersetLabel = group ? supersetLabels[group] ?? null : null;

  const missingWeightSetCount =
    loggingType === "strength"
      ? sets.reduce((acc, s) => {
          if (s.reps === null) return acc;
          if (s.weight === null) return acc + 1;
          return acc;
        }, 0)
      : 0;

  const volumeKg = calcVolumeKg(ex, profile);

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

    const exerciseVMs = exercisesSorted.map((ex: any) =>
      buildExerciseVM(ex, supersetLabels),
    );

    const durationSeconds = deriveTimerSeconds(draft);
    const exercisesTotal = exerciseVMs.length;

    const exercisesWithCompletedSets = exerciseVMs.filter(
      (e) => e.completedSetsCount > 0,
    ).length;

    const setsCompleted = exerciseVMs.reduce(
      (acc, e) => acc + e.completedSetsCount,
      0,
    );

    const volumeKg = exerciseVMs.reduce((acc, e) => acc + e.volumeKg, 0);

    const issues: ReviewIssue[] = [];

    const missingWeightSets = exerciseVMs.reduce(
      (acc, e) => acc + e.missingWeightSetCount,
      0,
    );

    if (missingWeightSets > 0) {
      issues.push({
        key: "missing_weight",
        title: "Some sets are missing weight",
        detail: `${missingWeightSets} set${
          missingWeightSets === 1 ? "" : "s"
        } have reps but no weight.`,
        severity: "warn",
      });
    }

    const noCompletedExercises = exerciseVMs.filter(
      (e) => e.hasNoCompletedSets,
    ).length;

    if (noCompletedExercises > 0) {
      issues.push({
        key: "no_completed_sets",
        title: "Some exercises have no completed sets",
        detail: `${noCompletedExercises} exercise${
          noCompletedExercises === 1 ? "" : "s"
        } won’t be saved unless at least one set is filled.`,
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