// app/features/home/cta.ts
import { router } from "expo-router";

export function performCTA(cta: any) {
  if (!cta) return;

  switch (cta.action) {
    case "open_workouts_tab":
      router.push("/(tabs)/workout");
      return;

    case "start_workout":
      router.push({
        pathname: "/features/workouts/screens/WorkoutOverview",
        params: { workoutId: cta.workout_id, planWorkoutId: cta.plan_workout_id },
      });
      return;

    case "discover_plans":
      router.push("/features/plans/create/planInfo"); // adjust to your path
      return;

    case "quick_log_workout":
      router.push("/(tabs)/workout"); // or your "start workout" entry
      return;

    case "set_goal":
      router.push("/features/goals/goals");
      return;

    case "view_history":
      router.push("/features/workouts/history"); // adjust
      return;
  }
}
