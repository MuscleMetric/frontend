// app/features/workouts/create/state/actions.ts
import type { WorkoutDraftExercise } from "./types";

export type WorkoutDraftAction =
  | { type: "draft/init"; payload: { draftId: string; nowIso: string } }
  | { type: "draft/setTitle"; payload: { title: string; nowIso: string } }
  | { type: "draft/setNote"; payload: { note: string; nowIso: string } }
  | {
      type: "draft/addExercises";
      payload: { exercises: Array<{ exerciseId: string; name: string }>; nowIso: string };
    }
  | { type: "draft/removeExercise"; payload: { exerciseKey: string; nowIso: string } }
  | { type: "draft/reorderExercises"; payload: { from: number; to: number; nowIso: string } }
  | { type: "draft/toggleFavourite"; payload: { exerciseKey: string; nowIso: string } }
  | { type: "draft/setExerciseNote"; payload: { exerciseKey: string; note: string; nowIso: string } }
  | { type: "draft/toggleDropset"; payload: { exerciseKey: string; nowIso: string } }
  | {
      type: "draft/setSupersetGroup";
      payload: { exerciseKey: string; group: string | null; nowIso: string };
    }
  | { type: "draft/clearSupersetGroup"; payload: { group: string; nowIso: string } }
  | { type: "draft/markSaved"; payload: { snapshotHash: string; nowIso: string } }
  | { type: "draft/reset"; payload: { draftId: string; nowIso: string } };

export type DraftExercise = WorkoutDraftExercise;
