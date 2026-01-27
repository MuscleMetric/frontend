// app/features/workouts/create/state/useWorkoutDraft.ts
import { useMemo, useReducer } from "react";
import { workoutDraftReducer, initialDraft } from "./reducers";
import type { WorkoutDraft } from "./types";
import { nowIso, snapshotHash } from "./helpers";

export default function useWorkoutDraft(draftId: string) {
  const [draft, dispatch] = useReducer(
    workoutDraftReducer,
    initialDraft(draftId, nowIso())
  );

  const api = useMemo(() => {
    return {
      dispatch,

      setTitle: (title: string) =>
        dispatch({ type: "draft/setTitle", payload: { title, nowIso: nowIso() } }),

      setNote: (note: string) =>
        dispatch({ type: "draft/setNote", payload: { note, nowIso: nowIso() } }),

      addExercises: (items: Array<{ exerciseId: string; name: string }>) =>
        dispatch({
          type: "draft/addExercises",
          payload: { exercises: items, nowIso: nowIso() },
        }),

      removeExercise: (exerciseKey: string) =>
        dispatch({ type: "draft/removeExercise", payload: { exerciseKey, nowIso: nowIso() } }),

      reorderExercises: (from: number, to: number) =>
        dispatch({ type: "draft/reorderExercises", payload: { from, to, nowIso: nowIso() } }),

      toggleFavourite: (exerciseKey: string) =>
        dispatch({ type: "draft/toggleFavourite", payload: { exerciseKey, nowIso: nowIso() } }),

      setExerciseNote: (exerciseKey: string, note: string) =>
        dispatch({ type: "draft/setExerciseNote", payload: { exerciseKey, note, nowIso: nowIso() } }),

      // NEW
      toggleDropset: (exerciseKey: string) =>
        dispatch({ type: "draft/toggleDropset", payload: { exerciseKey, nowIso: nowIso() } }),

      // NEW
      setSupersetGroup: (exerciseKey: string, group: string | null) =>
        dispatch({
          type: "draft/setSupersetGroup",
          payload: { exerciseKey, group, nowIso: nowIso() },
        }),

      // optional helper
      clearSupersetGroup: (group: string) =>
        dispatch({ type: "draft/clearSupersetGroup", payload: { group, nowIso: nowIso() } }),

      markSavedNow: () =>
        dispatch({
          type: "draft/markSaved",
          payload: { snapshotHash: snapshotHash(draft as WorkoutDraft), nowIso: nowIso() },
        }),
    };
  }, [draft]);

  return { draft: draft as WorkoutDraft, ...api };
}
