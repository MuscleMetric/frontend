// app/features/workouts/live/review/reviewTypes.ts
export type ReviewSummary = {
  durationSeconds: number;
  durationText: string;
  exercisesTotal: number;
  exercisesWithCompletedSets: number;
  setsCompleted: number;
  volumeKg: number;
  volumeText: string;
};

export type ReviewIssue = {
  key: string;
  title: string;
  detail: string;
  severity: "warn" | "error";
  exerciseIndex?: number; // index in sorted list
  setNumber?: number;
};

export type ReviewSetRow = {
  setNumber: number;
  dropIndex: number;

  reps: number | null;
  weight: number | null;

  timeSeconds: number | null;
  distance: number | null;

  // UI helpers
  isCardio: boolean;
  isComplete: boolean; // “complete enough” for saving
  missingLabel?: string | null;
};

export type ReviewExerciseVM = {
  id: string; // exerciseId
  name: string;
  type: string | null;
  equipment: string | null;

  orderIndex: number;

  supersetLabel?: string | null;
  isDropset?: boolean;

  sets: ReviewSetRow[];

  // totals
  completedSetsCount: number;
  volumeKg: number;

  // validation
  hasNoCompletedSets: boolean;
  missingWeightSetCount: number;
};

export type ReviewVM = {
  summary: ReviewSummary;
  issues: ReviewIssue[];
  exercises: ReviewExerciseVM[];
};
