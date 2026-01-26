import type { WorkoutDraft } from "./types";
import type { WorkoutDraftAction } from "./actions";
import { makeDraftExercise, normalizeNote } from "./actions";
import { moveArrayItem, snapshotHash } from "./helpers";

export const initialDraft = (draftId: string, nowIso: string): WorkoutDraft => ({
  id: draftId,
  title: "",
  note: null,
  exercises: [],
  createdAtIso: nowIso,
  updatedAtIso: nowIso,
  lastSavedSnapshotHash: null,
});

export function workoutDraftReducer(state: WorkoutDraft, action: WorkoutDraftAction): WorkoutDraft {
  switch (action.type) {
    case "draft/init": {
      return initialDraft(action.payload.draftId, action.payload.nowIso);
    }

    case "draft/reset": {
      return initialDraft(action.payload.draftId, action.payload.nowIso);
    }

    case "draft/setTitle": {
      const title = action.payload.title;
      if (title === state.title) return state;
      return { ...state, title, updatedAtIso: action.payload.nowIso };
    }

    case "draft/setNote": {
      const note = normalizeNote(action.payload.note);
      const nextNote = note.length ? note : null;
      if ((state.note ?? "") === (nextNote ?? "")) return state;
      return { ...state, note: nextNote, updatedAtIso: action.payload.nowIso };
    }

    case "draft/addExercises": {
      const existing = new Set(state.exercises.map((e) => e.exerciseId));
      const toAdd = action.payload.exercises
        .filter((x) => !existing.has(x.exerciseId))
        .map(makeDraftExercise);

      if (!toAdd.length) return state;

      return {
        ...state,
        exercises: [...state.exercises, ...toAdd],
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/removeExercise": {
      const before = state.exercises.length;
      const exercises = state.exercises.filter((e) => e.exerciseId !== action.payload.exerciseId);
      if (exercises.length === before) return state;
      return { ...state, exercises, updatedAtIso: action.payload.nowIso };
    }

    case "draft/reorderExercises": {
      const { from, to } = action.payload;
      if (from === to) return state;
      if (from < 0 || to < 0) return state;
      if (from >= state.exercises.length || to >= state.exercises.length) return state;

      return {
        ...state,
        exercises: moveArrayItem(state.exercises, from, to),
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/toggleFavourite": {
      const idx = state.exercises.findIndex((e) => e.exerciseId === action.payload.exerciseId);
      if (idx < 0) return state;

      const ex = state.exercises[idx];
      const next = state.exercises.slice();
      next[idx] = { ...ex, isFavourite: !ex.isFavourite };

      // Important: do NOT auto-reorder here. Favourite is a “quick sort hint”
      // but you said it helps ordering — user stays in control.

      return { ...state, exercises: next, updatedAtIso: action.payload.nowIso };
    }

    case "draft/setExerciseNote": {
      const idx = state.exercises.findIndex((e) => e.exerciseId === action.payload.exerciseId);
      if (idx < 0) return state;

      const ex = state.exercises[idx];
      const note = normalizeNote(action.payload.note);
      const nextNote = note.length ? note : null;

      if ((ex.note ?? "") === (nextNote ?? "")) return state;

      const next = state.exercises.slice();
      next[idx] = { ...ex, note: nextNote };

      return { ...state, exercises: next, updatedAtIso: action.payload.nowIso };
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

// convenience: if you ever want reducer-local dirty check
export function isDirtyDraft(draft: WorkoutDraft): boolean {
  if (!draft.lastSavedSnapshotHash) return true;
  return snapshotHash(draft) !== draft.lastSavedSnapshotHash;
}
