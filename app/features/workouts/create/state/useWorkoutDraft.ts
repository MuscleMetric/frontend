// app/features/workouts/create/state/useWorkoutDraft.ts
import { useCallback, useReducer } from "react";
import { workoutDraftReducer, initialDraft } from "./reducers";
import type { WorkoutDraft } from "./types";
import { nowIso, snapshotHash } from "./helpers";

export default function useWorkoutDraft(draftId: string) {
  const [draft, dispatch] = useReducer(
    workoutDraftReducer,
    initialDraft(draftId, nowIso())
  );

  // ✅ STABLE ACTIONS (do not depend on draft)
  const hydrateDraft = useCallback((next: WorkoutDraft) => {
    dispatch({
      type: "draft/hydrate",
      payload: { draft: next, nowIso: nowIso() },
    });
  }, []);

  const setTitle = useCallback((title: string) => {
    dispatch({ type: "draft/setTitle", payload: { title, nowIso: nowIso() } });
  }, []);

  const setNote = useCallback((note: string) => {
    dispatch({ type: "draft/setNote", payload: { note, nowIso: nowIso() } });
  }, []);

  const addExercises = useCallback((items: Array<{ exerciseId: string; name: string }>) => {
    dispatch({
      type: "draft/addExercises",
      payload: { exercises: items, nowIso: nowIso() },
    });
  }, []);

  const removeExercise = useCallback((exerciseKey: string) => {
    dispatch({
      type: "draft/removeExercise",
      payload: { exerciseKey, nowIso: nowIso() },
    });
  }, []);

  const reorderExercises = useCallback((from: number, to: number) => {
    dispatch({
      type: "draft/reorderExercises",
      payload: { from, to, nowIso: nowIso() },
    });
  }, []);

  const toggleFavourite = useCallback((exerciseKey: string) => {
    dispatch({
      type: "draft/toggleFavourite",
      payload: { exerciseKey, nowIso: nowIso() },
    });
  }, []);

  const setExerciseNote = useCallback((exerciseKey: string, note: string) => {
    dispatch({
      type: "draft/setExerciseNote",
      payload: { exerciseKey, note, nowIso: nowIso() },
    });
  }, []);

  const toggleDropset = useCallback((exerciseKey: string) => {
    dispatch({
      type: "draft/toggleDropset",
      payload: { exerciseKey, nowIso: nowIso() },
    });
  }, []);

  const setSupersetGroup = useCallback((exerciseKey: string, group: string | null) => {
    dispatch({
      type: "draft/setSupersetGroup",
      payload: { exerciseKey, group, nowIso: nowIso() },
    });
  }, []);

  const clearSupersetGroup = useCallback((group: string) => {
    dispatch({
      type: "draft/clearSupersetGroup",
      payload: { group, nowIso: nowIso() },
    });
  }, []);

  // ✅ THIS ONE DOES depend on draft (snapshotHash), so it must be recreated when draft changes
  const markSavedNow = useCallback(() => {
    dispatch({
      type: "draft/markSaved",
      payload: { snapshotHash: snapshotHash(draft as WorkoutDraft), nowIso: nowIso() },
    });
  }, [draft]);

  return {
    draft: draft as WorkoutDraft,
    dispatch,

    hydrateDraft,

    setTitle,
    setNote,
    addExercises,

    removeExercise,
    reorderExercises,
    toggleFavourite,
    setExerciseNote,

    toggleDropset,
    setSupersetGroup,
    clearSupersetGroup,

    markSavedNow,
  };
}
