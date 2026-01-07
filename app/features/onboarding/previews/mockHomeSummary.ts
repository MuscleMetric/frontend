export const mockHomeSummary = {
  server_time: new Date().toISOString(),
  home_variant: "experienced_plan",
  transition: null,
  user: {
    name: "You",
    units: "kg",
    steps_goal: 10000,
    weekly_workout_goal: 3,
    active_plan_id: "demo-plan",
    workouts_total: 12,
    days_since_last_workout: 1,
  },
  cards: [
    {
      type: "hero",
      badge: "TODAY’S FOCUS",
      title: "Pull Day (Demo)",
      subtitle: "Your next planned session is ready.",
      meta: {
        workout_id: "demo-workout",
        plan_workout_id: "demo-plan-workout",
        title: "Pull Day (Demo)",
        exercise_count: 6,
        avg_duration_seconds: 3100,
        plan_week_number: 2,
        week_workout_number: 1,
        exercise_preview: ["Lat Pulldown", "DB Row", "Pull Ups", "Hammer Curl"],
      },
      primary_cta: { label: "Start Workout", cta: { action: "noop" } },
    },
    {
      type: "weekly_goal",
      title: "This Week",
      value: 2,
      target: 3,
      status: "on_track",
    },
    {
      type: "latest_pr",
      exercise_id: "demo-ex",
      exercise_name: "Barbell Bench Press",
      best_weight: 90,
      best_reps: 6,
      display_value: "108.0 kg e1RM",
      delta_pct: 3.2,
      achieved_at: new Date().toISOString(),
    },
    {
      type: "volume_trend",
      label: "Volume",
      value: 18340,
      unit: "kg",
      delta_pct: 6.8,
      sparkline: [
        { label: "16 Dec", value: 12000 },
        { label: "23 Dec", value: 14600 },
        { label: "30 Dec", value: 17100 },
        { label: "06 Jan", value: 18340 },
      ],
    },
    {
      type: "streak",
      label: "Consistency",
      weekly_streak: 5,
      months: [
        {
          month_start: "2026-01-01",
          days: Array.from({ length: 31 }).map((_, i) => {
            const day = String(i + 1).padStart(2, "0");
            const trained = [2, 4, 6, 9, 12, 15, 18, 22, 26, 29].includes(i + 1);
            return {
              day: `2026-01-${day}`,
              trained,
              workout_count: trained ? 1 : 0,
            };
          }),
        },
        {
          month_start: "2025-12-01",
          days: Array.from({ length: 31 }).map((_, i) => {
            const day = String(i + 1).padStart(2, "0");
            const trained = [1, 3, 7, 10, 14, 17, 20, 24, 28].includes(i + 1);
            return {
              day: `2025-12-${day}`,
              trained,
              workout_count: trained ? 1 : 0,
            };
          }),
        },
        {
          month_start: "2025-11-01",
          days: Array.from({ length: 30 }).map((_, i) => {
            const day = String(i + 1).padStart(2, "0");
            const trained = [2, 5, 9, 13, 16, 19, 23, 27].includes(i + 1);
            return {
              day: `2025-11-${day}`,
              trained,
              workout_count: trained ? 1 : 0,
            };
          }),
        },
      ],
    },
    {
      type: "plan_goals",
      items: [
        { id: "g1", title: "Bench Press", progress_pct: 42, subtitle: null },
        { id: "g2", title: "Pull Ups", progress_pct: 58, subtitle: null },
        { id: "g3", title: "Squat", progress_pct: 33, subtitle: null },
      ],
    },
  ],
};
