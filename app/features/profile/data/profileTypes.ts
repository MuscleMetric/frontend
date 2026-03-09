// app/features/profile/data/profileTypes.ts
export type ProfileVariant =
  | "new_user"
  | "experienced_no_plan"
  | "experienced_with_plan";

export type ProfileOverview = {
  profile_variant: ProfileVariant;

  user: {
    id: string;
    name: string | null;
    joined_at: string;
    level: string | null;
    primary_goal: string | null;
    is_private: boolean;
    username: string | null;
    username_lower: string | null;
  };

  counts: {
    workouts_total: number;
    followers_count: number;
    following_count: number;
  };

  onboarding: {
    required: {
      has_saved_details: boolean;
      has_completed_workout: boolean;
      has_followed_official: boolean;
    };
    done_count: number;
    total_count: number;
    progress_pct: number;
    next_action_key: "save_details" | "complete_workout" | "follow_official" | "done";
  };

  active_plan: null | {
    plan_id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    weekly_target_sessions: number;
    week_start: string; // date string
    week_index: number | null;
    weeks_total: number | null;
    weeks_left_future: number | null;
    planned_workouts_left: number | null;
    completed_this_week: number;
    weekly_progress_pct: number;
  };

  activity: {
    weekly_streak: number;
    steps_streak_days: number;
    achievements_unlocked: number;
    achievements_total: number;
    achievements_pct: number;
  };

  favourite_achievements: Array<{
    id: string;
    title: string;
    category: string;
    difficulty: string;
    description: string;
  }>;

  recent_plans: Array<{
    id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    is_completed: boolean;
    completed_at: string | null;
  }>;

  recent_history: Array<{
    workout_history_id: string;
    completed_at: string;
    duration_seconds: number | null;
    workout_title: string;
    volume: number;
  }>;

  recent_posts: Array<{
    post_id: string;
    post_type: "workout" | "pr" | "text";
    caption: string | null;
    created_at: string;
    workout_history_id: string | null;
    exercise_id: string | null;
    pr_snapshot: any;
    likes_count: number;
    comments_count: number;
  }>;
};
