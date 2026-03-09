// app/features/social/feed/modals/types.ts

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string | null;
  user_username: string | null;
  body: string;
  created_at: string;
};

export type WorkoutDetailsPayload = {
  workout_history_id: string;
  workout_title: string | null;
  completed_at: string | null;

  exercises: Array<{
    workout_exercise_history_id: string;
    exercise_id: string | null;
    exercise_name: string | null;
    order_index: number | null;
    sets: Array<{
      id: string;
      set_index: number | null;
      reps: number | null;
      weight: number | null;
      is_done: boolean | null;
    }>;
  }>;
};