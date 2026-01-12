export type WorkoutsTabState = "new_user" | "no_plan" | "with_plan";

export type WorkoutsTabPayload = {
  state: WorkoutsTabState;

  header: {
    title: string;
    actions: {
      showSearch: boolean;
      showNotifications?: boolean;
    };
  };

  setup?: {
    title: string;
    subtitle: string;
    progressPct: number; // you can override client-side if you want
    cta: { label: string; action: "create_first_workout" };
  };

  suggested?: {
    title: "Suggested for You";
    seeAll: boolean;
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string; // workouts.workout_image_key
      previewText: string;
      tapAction: "preview";
    }>;
  };

  myWorkouts: {
    title: "My Workouts";
    seeAll: boolean;
    emptyState?: {
      title: string;
      subtitle: string;
      ctaPrimary: { label: string; action: "create_workout" };
      ctaSecondary?: { label: string; action: "explore_plans" };
    };
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string;
      exerciseCount: number;
      previewText: string;
      lastDoneAt: string | null;
    }>;
  };

  activePlan?: {
    planId: string;
    title: string;
    progress: { completedCount: number; totalCount: number; pct: number };
    nextWorkout: {
      planWorkoutId: string;
      workoutId: string;
      title: string;
      imageKey: string;
    } | null;
    primaryCta: { label: string; action: "start_workout" };
  };

  planSchedule?: {
    title: "Plan Schedule";
    actions: { viewAll: boolean; edit: boolean };
    items: Array<{
      planWorkoutId: string;
      workoutId: string;
      title: string;
      orderIndex: number | null;
      weeklyComplete: boolean;
      imageKey: string;
      previewText: string;
    }>;
  };

  optionalSessions?: {
    title: "Optional Sessions";
    actionCreate: boolean;
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string;
      previewText: string;
      lastDoneAt: string | null;
    }>;
  };

  fab: {
    visible: boolean;
    action: "create_workout" | "create_menu";
  };
};
