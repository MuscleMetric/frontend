// app/features/workouts/create/state/defaults.ts
import type { WorkoutDraft, WorkoutDraftExercise } from "./types";
import { makeExerciseKey } from "./helpers";

export function initialDraft(draftId: string, nowIso: string): WorkoutDraft {
  return {
    id: draftId,
    title: "",
    note: null,
    exercises: [],
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    lastSavedSnapshotHash: null,
  };
}

export function makeDraftExercise(input: { exerciseId: string; name: string }): WorkoutDraftExercise {
  return {
    key: makeExerciseKey(),
    exerciseId: input.exerciseId,
    name: input.name ?? "",
    note: null,
    isFavourite: false,

    // NEW
    isDropset: false,
    supersetGroup: null,
    supersetIndex: null,
  };
}
