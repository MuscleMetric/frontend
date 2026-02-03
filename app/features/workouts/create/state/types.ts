// app/features/workouts/create/state/types.ts

export type WorkoutDraftExercise = {
  key: string; // stable UI key (allows duplicates)
  exerciseId: string;
  name: string; // denormalised at add-time
  note: string | null;

  // affects ordering + quick pick logic
  isFavourite: boolean;

  // NEW
  isDropset: boolean;

  // "A", "B", ... (user-facing)
  supersetGroup: string | null;

  // 0..n inside group (computed by reducer)
  supersetIndex: number | null;
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
