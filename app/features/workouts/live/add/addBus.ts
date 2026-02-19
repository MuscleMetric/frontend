// app/features/workouts/live/add/addBus.ts
export type AddExerciseLite = {
  id: string;
  name: string;
  type?: string;
  equipment?: string | null;
  muscleIds?: string[];
};

export type AddExercisesResult = {
  selectedIds: string[];

  // ✅ NEW: optional details (fixes "created exercise not in options yet")
  selected?: AddExerciseLite[];
};

type Handler = ((result: AddExercisesResult) => void) | null;

let handler: Handler = null;

export function setAddExercisesHandler(next: Handler) {
  handler = next;
}

export function emitAddExercisesResult(result: AddExercisesResult) {
  if (handler) handler(result);
}