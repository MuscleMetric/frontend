// app/features/workouts/types/workoutsTab.ts

export type WorkoutsTabState = "new_user" | "no_plan" | "with_plan";

export type WorkoutsTabPayload = {
  state: WorkoutsTabState;

  workoutsTotal: number;

  setup?: {
    title: string;
    subtitle: string;
    progressPct: number; // 0..100
    cta: { label: string; action: "create_first_workout" };
  };

  suggested?: {
    title: string;
    seeAll: boolean;
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string | null;
      previewText: string;
      tapAction: "preview";
    }>;
  };

  myWorkouts: {
    title: string;
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
      imageKey: string | null;
      exerciseCount: number;
      previewText: string;
      lastDoneAt: string | null; // ISO
    }>;
  };

  activePlan?: {
    planId: string;
    title: string;

    metaLine?: string | null; // "Week 3 of 12 • 4 Days Left"

    progress: { completedCount: number; totalCount: number; pct: number };

    coachTip?: {
      text: string;
    } | null;

    nextWorkout: {
      planWorkoutId: string;
      workoutId: string;
      title: string;
      imageKey: string | null;
    } | null;

    primaryCta: { label: string; action: "start_workout" };
  };

  planSchedule?: {
    title: string;
    actions: { viewAll: boolean; edit: boolean };
    items: Array<{
      planWorkoutId: string;
      workoutId: string;
      title: string;
      orderIndex: number | null;
      weeklyComplete: boolean;
      imageKey: string | null;
      previewText: string;
      lastDoneAt: string | null; 
    }>;
  };

  optionalSessions?: {
    title: string;
    actionCreate: boolean;
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string | null;
      previewText: string;
      lastDoneAt: string | null;
    }>;
  };
};
