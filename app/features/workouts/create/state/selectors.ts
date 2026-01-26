import type { WorkoutDraft } from "./types";
import { snapshotHash } from "./helpers";

export function selectExerciseCount(d: WorkoutDraft) {
  return d.exercises.length;
}

export function selectCanSave(d: WorkoutDraft) {
  // minimal rules for “loose workout”
  return d.title.trim().length > 0 && d.exercises.length > 0;
}

export function selectHasChanges(d: WorkoutDraft) {
  if (!d.lastSavedSnapshotHash) {
    // if you prefer: return title/exercises present only
    return true;
  }
  return snapshotHash(d) !== d.lastSavedSnapshotHash;
}

export function selectFavouriteCount(d: WorkoutDraft) {
  return d.exercises.reduce((sum, e) => sum + (e.isFavourite ? 1 : 0), 0);
}
