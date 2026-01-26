import { useMemo, useReducer } from "react";
import { workoutDraftReducer, initialDraft } from "./reducers";
import type { WorkoutDraft } from "./types";
import type { WorkoutDraftAction } from "./actions";
import { nowIso, snapshotHash } from "./helpers";

export default function useWorkoutDraft(draftId: string) {
  const [draft, dispatch] = useReducer(workoutDraftReducer, initialDraft(draftId, nowIso()));

  const api = useMemo(() => {
    return {
      dispatch,

      setTitle: (title: string) =>
        dispatch({ type: "draft/setTitle", payload: { title, nowIso: nowIso() } }),

      setNote: (note: string) =>
        dispatch({ type: "draft/setNote", payload: { note, nowIso: nowIso() } }),

      addExercises: (items: Array<{ exerciseId: string; name: string }>) =>
        dispatch({ type: "draft/addExercises", payload: { exercises: items, nowIso: nowIso() } }),

      removeExercise: (exerciseId: string) =>
        dispatch({ type: "draft/removeExercise", payload: { exerciseId, nowIso: nowIso() } }),

      reorderExercises: (from: number, to: number) =>
        dispatch({ type: "draft/reorderExercises", payload: { from, to, nowIso: nowIso() } }),

      toggleFavourite: (exerciseId: string) =>
        dispatch({ type: "draft/toggleFavourite", payload: { exerciseId, nowIso: nowIso() } }),

      setExerciseNote: (exerciseId: string, note: string) =>
        dispatch({ type: "draft/setExerciseNote", payload: { exerciseId, note, nowIso: nowIso() } }),

      markSavedNow: () =>
        dispatch({
          type: "draft/markSaved",
          payload: { snapshotHash: snapshotHash(draft as WorkoutDraft), nowIso: nowIso() },
        }),
    };
  }, [draft]);

  return { draft: draft as WorkoutDraft, ...api };
}
