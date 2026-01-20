// live/modals/helpers/dropset.ts
import type { LiveExerciseDraft } from "../../state/types";

export function getBaseSetCount(ex: LiveExerciseDraft) {
  return ex.sets.filter((s) => (s.dropIndex ?? 0) === 0).length;
}

export function getDropRowsForSetNumber(ex: LiveExerciseDraft, setNumber: number) {
  return ex.sets
    .filter((s) => s.setNumber === setNumber && (s.dropIndex ?? 0) > 0)
    .sort((a, b) => (a.dropIndex ?? 0) - (b.dropIndex ?? 0));
}

export function dropModeForSet(ex: LiveExerciseDraft, setNumber: number) {
  return getDropRowsForSetNumber(ex, setNumber).length > 0;
}
