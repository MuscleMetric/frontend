export type WorkoutDraftExercise = {
  exerciseId: string;
  name: string; // denormalised for fast UI (from exercises table at add-time)
  note: string | null;

  // favourites affect ordering (you said you use it to help order)
  isFavourite: boolean;
};

export type WorkoutDraft = {
  id: string; // local draft id (not DB id)
  title: string;
  note: string | null; // workout-level notes
  exercises: WorkoutDraftExercise[];

  createdAtIso: string;
  updatedAtIso: string;

  // used for discard changes sheet / dirty checks
  lastSavedSnapshotHash: string | null;
};
