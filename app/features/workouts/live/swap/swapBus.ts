// app/features/workouts/live/swap/swapBus.ts
export type SwapPickedExercise = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
  level: string | null;
  instructions: string | null;
};

let handler: ((picked: SwapPickedExercise) => void) | null = null;

export function setSwapHandler(fn: ((picked: SwapPickedExercise) => void) | null) {
  handler = fn;
}

export function emitSwapPicked(picked: SwapPickedExercise) {
  handler?.(picked);
}
