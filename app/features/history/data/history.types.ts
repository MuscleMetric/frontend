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

export type CardioPR = {
  id: string;
  exercise_id: string;
  exercise_name: string;
  metric:
    | "longest_distance"
    | "best_pace"
    | "fastest_1k"
    | "fastest_3k"
    | "fastest_5k"
    | "fastest_10k"
    | "fastest_15k"
    | "fastest_20k"
    | "fastest_half_marathon"
    | "fastest_marathon";
  benchmark_distance_km: number | null;
  value: number;
  achieved_at: string;
  workout_set_history_id: string;
};

export type WorkoutDetailSet = {
  set_id: string;
  set_number: number;

  reps: number | null;
  weight_kg: number | null;
  e1rm: number | null;

  time_seconds: number | null;
  distance: number | null;

  is_best: boolean;
  is_pr: boolean;
  is_cardio_pr: boolean;
};

export type WorkoutDetailExercise = {
  exercise_id: string;
  exercise_name: string;
  order_index: number;

  is_pr: boolean;
  is_cardio_pr: boolean;

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
    distance_total: number;
    insight: HistoryInsight;
  };
  prs: WorkoutDetailPR[];
  cardio_prs: CardioPR[];
  exercises: WorkoutDetailExercise[];
};
