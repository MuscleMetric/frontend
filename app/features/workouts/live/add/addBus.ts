// app/features/workouts/live/add/addBus.ts

export type AddExercisesResult = {
  selectedIds: string[];
};

type Handler = ((result: AddExercisesResult) => void) | null;

let handler: Handler = null;

export function setAddExercisesHandler(next: Handler) {
  handler = next;
}

export function emitAddExercisesResult(result: AddExercisesResult) {
  if (handler) handler(result);
}
