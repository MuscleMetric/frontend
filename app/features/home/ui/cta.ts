// app/features/home/cta.ts
import { router } from "expo-router";

export function performCTA(cta: any) {
  if (!cta) return;

  switch (cta.action) {
    case "open_workouts_tab":
      router.push("/workout");
      return;

    case "start_workout": {
      if (!cta.workout_id) {
        router.push("/workout");
        return;
      }

      const params: Record<string, string> = {
        workoutId: cta.workout_id,
      };

      if (cta.plan_workout_id) {
        params.planWorkoutId = cta.plan_workout_id;
      }

      router.push({
        pathname: "/features/workouts/screens/WorkoutOverview",
        params,
      });
      return;
    }

    case "discover_plans":
      router.push("/features/plans/create/planInfo"); // adjust to your path
      return;

    case "quick_log_workout":
      router.push("/workout"); // or your "start workout" entry
      return;

    case "set_goal":
      router.push("/features/goals/goals");
      return;
  }
}
