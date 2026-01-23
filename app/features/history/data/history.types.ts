// app/features/history/data/history.types.ts

export type HistoryInsight = {
  metric: "volume";
  trend: "up" | "down" | "flat";
  delta_pct: number; // e.g. +5.2
  label: string; // "Lifted 5% more than last time"
} | null;

export type HistoryListItem = {
  workout_history_id: string;
  workout_id: string | null;
  title: string;
  completed_at: string; // timestamptz
  duration_seconds: number | null;

  volume_kg: number; // session volume (strength only)
  sets_count: number; // session set count (strength only)

  pr_count: number; // PRs hit in that session
  top_items: {
    exercise_id: string;
    exercise_name: string;
    summary: string; // "3 × 10" or "4 sets"
  }[];

  insight: HistoryInsight;
};

export type HistoryListPayload = {
  meta: {
    generated_at?: string;
    timezone: string;
    unit: "kg";
  };
  items: HistoryListItem[];
};

export type WorkoutDetailPR = {
  exercise_id: string;
  exercise_name: string;
  e1rm: number;
  weight_kg: number;
  reps: number;
  delta_abs: number | null;
  delta_pct: number | null;
};

export type WorkoutDetailSet = {
  set_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  e1rm: number | null;
  is_best: boolean;
};

export type WorkoutDetailExercise = {
  exercise_id: string;
  exercise_name: string;
  order_index: number;
  sets: WorkoutDetailSet[];
};

export type WorkoutHistoryDetailPayload = {
  meta: {
    timezone: string;
    unit: "kg";
  };
  header: {
    workout_history_id: string;
    workout_id: string | null;
    title: string;
    completed_at: string;
    notes: string | null;
  };
  stats: {
    duration_seconds: number | null;
    sets_count: number;
    volume_kg: number;
  };
  prs: WorkoutDetailPR[];
  exercises: WorkoutDetailExercise[];
};
