// app/features/workouts/create/state/reducers.ts
import type { WorkoutDraft } from "./types";
import type { WorkoutDraftAction } from "./actions";
import {
  initialDraft as makeInitialDraft,
  makeDraftExercise,
} from "./defaults";
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

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// Returns [start, endExclusive) for the "block" that index belongs to.
// If index is in a superset group, the block is the whole contiguous group.
// Otherwise it's just the single item.
function getBlockRange(
  exercises: WorkoutDraft["exercises"],
  index: number
): { start: number; end: number; group: string | null } {
  const ex = exercises[index];
  if (!ex) return { start: index, end: index + 1, group: null };

  const g = ex.supersetGroup;
  if (!g) return { start: index, end: index + 1, group: null };

  let start = index;
  while (start - 1 >= 0 && exercises[start - 1].supersetGroup === g) start--;

  let end = index + 1;
  while (end < exercises.length && exercises[end].supersetGroup === g) end++;

  return { start, end, group: g };
}

// Snap an insertion index so we never insert "inside" a superset block.
// If insertIndex lands inside another group's block, snap to before/after that block.
function snapInsertIndexToBlockEdge(
  exercises: WorkoutDraft["exercises"],
  insertIndex: number,
  direction: "up" | "down"
) {
  // inserting at end is always valid
  if (insertIndex <= 0) return 0;
  if (insertIndex >= exercises.length) return exercises.length;

  // If the item at insertIndex is in a group, we might be trying to insert inside its block.
  const at = exercises[insertIndex];
  if (!at?.supersetGroup) return insertIndex;

  const r = getBlockRange(exercises, insertIndex);
  // If direction is down, put after the block; otherwise before.
  return direction === "down" ? r.end : r.start;
}

// Move a slice [start,end) to a new insertion index
function moveBlock<T>(
  arr: T[],
  start: number,
  end: number,
  insertIndex: number
) {
  const block = arr.slice(start, end);
  const rest = arr.slice(0, start).concat(arr.slice(end));

  const idx = clamp(insertIndex, 0, rest.length);
  const next = rest.slice();
  next.splice(idx, 0, ...block);
  return next;
}

// Force a group's members to be contiguous.
// Keeps relative order of group members as they appear in the list.
// Places the block at the earliest position any member currently occupies.
function compactSupersetGroup(
  exercises: WorkoutDraft["exercises"],
  group: string
) {
  const g = String(group);

  const indices: number[] = [];
  for (let i = 0; i < exercises.length; i++) {
    if (exercises[i].supersetGroup === g) indices.push(i);
  }

  // 0 or 1 member => already "compact"
  if (indices.length <= 1) return exercises;

  const insertAt = indices[0]; // earliest index

  // extract group members (in current order)
  const groupMembers = exercises.filter((ex) => ex.supersetGroup === g);
  // remaining members
  const rest = exercises.filter((ex) => ex.supersetGroup !== g);

  // insert group block back at insertAt relative to original list:
  // insertAt is based on original array, but rest is shorter now.
  // So we compute how many non-group items were before insertAt.
  let nonGroupBefore = 0;
  for (let i = 0; i < insertAt; i++) {
    if (exercises[i].supersetGroup !== g) nonGroupBefore++;
  }

  const next = rest.slice();
  next.splice(nonGroupBefore, 0, ...groupMembers);
  return next;
}

export function workoutDraftReducer(
  state: WorkoutDraft,
  action: WorkoutDraftAction
): WorkoutDraft {
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
      const next = [...state.exercises, ...added];

      console.log("Added:", added.length);
      console.log("Final:", next.length);

      return {
        ...state,
        exercises: next,
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/removeExercise": {
      const next = state.exercises.filter(
        (ex) => ex.key !== action.payload.exerciseKey
      );
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
      if (from >= state.exercises.length || to >= state.exercises.length)
        return state;

      const direction: "up" | "down" = to > from ? "down" : "up";

      // 1) Determine the dragged block (single item or whole superset group)
      const dragged = getBlockRange(state.exercises, from);
      const blockLen = dragged.end - dragged.start;

      // If user drags within the same block, ignore
      if (to >= dragged.start && to < dragged.end) return state;

      // 2) Compute a raw insertion index as if we removed the block first
      // The drag library gives `to` as an index in the ORIGINAL list.
      let rawInsert = to;

      // When moving downward, removing the block shifts indices left.
      if (rawInsert > dragged.end) rawInsert -= blockLen;

      // Clamp into range of the "rest" list
      rawInsert = clamp(rawInsert, 0, state.exercises.length - blockLen);

      // 3) Build rest list (without dragged block)
      const rest = state.exercises
        .slice(0, dragged.start)
        .concat(state.exercises.slice(dragged.end));

      // 4) Snap insertion so we only land above/below OTHER superset blocks
      // If rawInsert lands inside a group block, snap to its edge.
      const snappedInsert = snapInsertIndexToBlockEdge(
        rest,
        rawInsert,
        direction
      );

      // 5) Perform the block move
      const next = moveBlock(
        state.exercises,
        dragged.start,
        dragged.end,
        snappedInsert
      );

      return {
        ...state,
        exercises: recomputeSupersetIndices(next),
        updatedAtIso: nowIso,
      };
    }

    case "draft/toggleFavourite": {
      const next = state.exercises.map((ex) =>
        ex.key === action.payload.exerciseKey
          ? { ...ex, isFavourite: !ex.isFavourite }
          : ex
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
        ex.key === action.payload.exerciseKey
          ? { ...ex, isDropset: !ex.isDropset }
          : ex
      );

      return {
        ...state,
        exercises: recomputeSupersetIndices(next),
        updatedAtIso: action.payload.nowIso,
      };
    }

    case "draft/setSupersetGroup": {
      const { exerciseKey, group, nowIso } = action.payload;

      const g = group ? String(group).toUpperCase() : null;

      // 1) assign group
      let next = state.exercises.map((ex) =>
        ex.key === exerciseKey ? { ...ex, supersetGroup: g } : ex
      );

      // 2) if clearing group, just recompute + return
      if (!g) {
        return {
          ...state,
          exercises: recomputeSupersetIndices(next),
          updatedAtIso: nowIso,
        };
      }

      // 3) compact the whole group to guarantee adjacency
      next = compactSupersetGroup(next, g);

      return {
        ...state,
        exercises: recomputeSupersetIndices(next),
        updatedAtIso: nowIso,
      };
    }

    case "draft/clearSupersetGroup": {
      const { group, nowIso } = action.payload;
      const next = state.exercises.map((ex) =>
        ex.supersetGroup === group
          ? { ...ex, supersetGroup: null, supersetIndex: null }
          : ex
      );

      return {
        ...state,
        exercises: recomputeSupersetIndices(next),
        updatedAtIso: nowIso,
      };
    }

    case "draft/markSaved": {
      return {
        ...state,
        lastSavedSnapshotHash: action.payload.snapshotHash,
        updatedAtIso: action.payload.nowIso,
      };
    }

    // inside workoutDraftReducer switch...
    case "draft/hydrate": {
      // Trust payload draft as canonical (already shaped correctly)
      return {
        ...action.payload.draft,
        updatedAtIso: action.payload.nowIso,
      };
    }

    default:
      return state;
  }
}
