export type ProgressOverview = {
  meta: {
    user_id: string;
    generated_at: string;
    timezone: string;
    unit: "kg";
  };

  momentum: {
    status: "on_fire" | "steady" | "returning" | "new_user";
    headline: string;
    subhead?: string | null;
    workouts_30d: number;
    streak_days: number;
    volume_30d: number;
    unit: "kg";
    workouts_prev_30d: number;
    volume_prev_30d: number;
  };

  consistency: {
    period: "month";
    months: Array<{
      key: string; // YYYY-MM
      label: string; // JAN
      workouts_completed: number;
      workout_goal?: number;
    }>;
    delta_vs_last_month_pct?: number | null;
    trend: "up" | "down" | "flat";
  };

  highlights: {
    primary?: {
      type: "first_pb" | "new_pr" | "milestone" | "consistency_win";
      title: string;
      subtitle: string;
      achieved_at?: string;
      exercise_id?: string;
    } | null;
    cards: Array<{
      exercise_id: string;
      exercise_name: string;
      metric: "e1rm";
      current_value: number;
      prev_value?: number | null;
      delta?: number | null;
      delta_pct?: number | null;
      e1rm: number;
      best_weight: number;
      best_reps: number;
      delta_abs: number | null;
      achieved_at: string;
    }>;
  };

  exercise_summary: {
    top_exercises: Array<{
      exercise_id: string;
      exercise_name: string;
      sessions_30d: number;
      last_done_at?: string | null;
      trend: "up" | "down" | "flat";
      latest_e1rm?: number | null;
      prev_e1rm?: number | null;
    }>;
    prompt?: { title: string; subtitle: string } | null;
  };

  recent_activity: {
    last_workout?: {
      workout_history_id: string;
      workout_id: string;
      title: string;
      completed_at: string;
      duration_seconds?: number | null;
      top_items: Array<{
        exercise_id: string;
        exercise_name: string;
        summary: string;
      }>;
    } | null;

    feed: Array<{
      type: "journey_started" | "workout_completed" | "pr" | "streak";
      title: string;
      subtitle?: string | null;
      occurred_at: string;
    }>;
  };
};
