// app/features/workouts/create/state/reducers.ts
import type { WorkoutDraft } from "./types";
import type { WorkoutDraftAction } from "./actions";
import { initialDraft as makeInitialDraft, makeDraftExercise } from "./defaults";
import { normalizeNote, normalizeTitle } from "./helpers";

export const initialDraft = makeInitialDraft;

function recomputeSupersetIndices(exercises: WorkoutDraft["exercises"]) {
  const counts: Record<string, number> = {};
  return exercises.map((ex) => {
    if (!ex.supersetGroup) return { ...ex, supersetIndex: null };
    const g = ex.supersetGroup;
    const idx = counts[g] ?? 0;
    counts[g] = idx + 1;
    return { ...ex, supersetIndex: idx };
  });
}

function move<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function workoutDraftReducer(state: WorkoutDraft, action: WorkoutDraftAction): WorkoutDraft {
  switch (action.type) {
    case "draft/init": {
      return makeInitialDraft(action.payload.draftId, action.payload.nowIso);
    }

    case "draft/reset": {
      return makeInitialDraft(action.payload.draftId, action.payload.nowIso);
    }

    case "draft/setTitle": {
      return {
        ...state,
        title: normalizeTitle(action.payload.title),
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/setNote": {
      return {
        ...state,
        note: normalizeNote(action.payload.note) || null,
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/addExercises": {
      const added = action.payload.exercises.map(makeDraftExercise);
      const next = recomputeSupersetIndices([...state.exercises, ...added]);

      return {
        ...state,
        exercises: next,
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/removeExercise": {
      const next = state.exercises.filter((ex) => ex.key !== action.payload.exerciseKey);
      return {
        ...state,
        exercises: recomputeSupersetIndices(next),
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/reorderExercises": {
      const { from, to, nowIso } = action.payload;
      if (from === to) return state;
      if (from < 0 || to < 0) return state;
      if (from >= state.exercises.length || to >= state.exercises.length) return state;

      const next = recomputeSupersetIndices(move(state.exercises, from, to));
      return { ...state, exercises: next, updatedAtIso: nowIso };
    }

    case "draft/toggleFavourite": {
      const next = state.exercises.map((ex) =>
        ex.key === action.payload.exerciseKey ? { ...ex, isFavourite: !ex.isFavourite } : ex
      );

      return {
        ...state,
        exercises: recomputeSupersetIndices(next),
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/setExerciseNote": {
      const note = normalizeNote(action.payload.note) || null;
      const next = state.exercises.map((ex) =>
        ex.key === action.payload.exerciseKey ? { ...ex, note } : ex
      );

      return {
        ...state,
        exercises: recomputeSupersetIndices(next),
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/toggleDropset": {
      const next = state.exercises.map((ex) =>
        ex.key === action.payload.exerciseKey ? { ...ex, isDropset: !ex.isDropset } : ex
      );

      return {
        ...state,
        exercises: recomputeSupersetIndices(next),
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/setSupersetGroup": {
      const { exerciseKey, group, nowIso } = action.payload;

      const next = state.exercises.map((ex) =>
        ex.key === exerciseKey
          ? { ...ex, supersetGroup: group ? String(group) : null }
          : ex
      );

      return { ...state, exercises: recomputeSupersetIndices(next), updatedAtIso: nowIso };
    }

    case "draft/clearSupersetGroup": {
      const { group, nowIso } = action.payload;
      const next = state.exercises.map((ex) =>
        ex.supersetGroup === group ? { ...ex, supersetGroup: null, supersetIndex: null } : ex
      );

      return { ...state, exercises: recomputeSupersetIndices(next), updatedAtIso: nowIso };
    }

    case "draft/markSaved": {
      return {
        ...state,
        lastSavedSnapshotHash: action.payload.snapshotHash,
        updatedAtIso: action.payload.nowIso,
      };
    }

    default:
      return state;
  }
}
