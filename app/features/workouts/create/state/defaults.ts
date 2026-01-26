import type { WorkoutDraft, DraftExercise } from "./types";

function randKey() {
  // fast + stable enough for UI keys
  return `ex_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function makeExerciseKey() {
  return randKey();
}

export function createEmptyDraft(): WorkoutDraft {
  return {
    title: "",
    note: null,
    isFavourite: false,
    exercises: [],
    updatedAt: Date.now(),
  };
}

export function normalizeTitle(input: string) {
  return input.replace(/\s+/g, " ").trimStart(); // keep trailing spaces while typing
}

export function withKeys(
  rows: Array<Omit<DraftExercise, "key">>
): DraftExercise[] {
  return rows.map((r) => ({ ...r, key: makeExerciseKey() }));
}
