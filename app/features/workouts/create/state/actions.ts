// app/features/workouts/create/state/actions.ts
import type { WorkoutDraftExercise } from "./types";

export type WorkoutDraftAction =
  | { type: "draft/init"; payload: { draftId: string; nowIso: string } }
  | { type: "draft/reset"; payload: { draftId: string; nowIso: string } }
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
  | {
      // Assign a group to TWO exercises (your “pick partner” flow)
      type: "draft/setSupersetGroupPair";
      payload: {
        aKey: string;
        bKey: string;
        group: string | null;
        nowIso: string;
      };
    }
  | {
      // Add one exercise into an existing group (supports 3+ later)
      type: "draft/addToSupersetGroup";
      payload: { exerciseKey: string; group: string; nowIso: string };
    }
  | { type: "draft/clearSupersetGroup"; payload: { group: string; nowIso: string } }
  | { type: "draft/markSaved"; payload: { snapshotHash: string; nowIso: string } };

export type DraftExercise = WorkoutDraftExercise;
