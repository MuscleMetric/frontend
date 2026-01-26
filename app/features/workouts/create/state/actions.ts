import type { WorkoutDraftExercise } from "./types";

export type WorkoutDraftAction =
  | { type: "draft/init"; payload: { draftId: string; nowIso: string } }
  | { type: "draft/setTitle"; payload: { title: string; nowIso: string } }
  | { type: "draft/setNote"; payload: { note: string; nowIso: string } }
  | {
      type: "draft/addExercises";
      payload: { exercises: Array<{ exerciseId: string; name: string }>; nowIso: string };
    }
  | { type: "draft/removeExercise"; payload: { exerciseId: string; nowIso: string } }
  | { type: "draft/reorderExercises"; payload: { from: number; to: number; nowIso: string } }
  | { type: "draft/toggleFavourite"; payload: { exerciseId: string; nowIso: string } }
  | { type: "draft/setExerciseNote"; payload: { exerciseId: string; note: string; nowIso: string } }
  | { type: "draft/markSaved"; payload: { snapshotHash: string; nowIso: string } }
  | { type: "draft/reset"; payload: { draftId: string; nowIso: string } };

export function normalizeNote(s: string) {
  return s.trim();
}

export function makeDraftExercise(input: { exerciseId: string; name: string }): WorkoutDraftExercise {
  return {
    exerciseId: input.exerciseId,
    name: input.name,
    note: null,
    isFavourite: false,
  };
}
