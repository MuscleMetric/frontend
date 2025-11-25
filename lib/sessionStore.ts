// lib/sessionStore.ts
export type StrengthDrop = { reps?: string; weight?: string };
export type StrengthSet = { reps?: string; weight?: string; drops?: StrengthDrop[] };
export type CardioSet = { distance?: string; timeSec?: string };

export type ExerciseState =
  | {
      kind: "strength";
      sets: StrengthSet[];
      currentSet: number;
      dropMode?: boolean;
      completed: boolean;
      notes?: string;
      open: boolean;
    }
  | {
      kind: "cardio";
      sets: CardioSet[];
      currentSet: number;
      completed: boolean;
      notes?: string;
      open: boolean;
    };

export type WorkoutExercise = {
  id: string;
  exercise_id: string;
  order_index: number | null;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_time_seconds: number | null;
  target_distance: number | null;
  notes: string | null;
  is_dropset?: boolean | null;
  superset_group?: string | null;
  superset_index?: number | null;
  exercises: { id: string; name: string | null; type: string | null } | null;
};

export type Workout = {
  id: string;
  title: string | null;
  workout_exercises: WorkoutExercise[];
};

export type SupersetInfo = {
  byGroup: Record<string, string[]>;   // groupId -> ordered weIds
  byWeId: Record<string, { group: string; pos: number }>;
  labels: Record<string, string>;      // groupId -> "A", "B", ...
};

export type InProgressState = {
  workoutNotes?: string;
  byWeId: Record<string, ExerciseState>;
  startedAt: number;
  cardioTimeBonusSec: number;
  anyCompleted: boolean;
};

export type ReviewPayload = {
  workout: Workout;
  state: InProgressState;
  supersets: SupersetInfo;
};

let _reviewPayload: ReviewPayload | null = null;

export function setReviewPayload(p: ReviewPayload | null) {
  _reviewPayload = p;
}
export function getReviewPayload(): ReviewPayload | null {
  return _reviewPayload;
}
export function clearReviewPayload() {
  _reviewPayload = null;
}
