// app/features/social/create/selectWorkout/mapWorkoutHistoryToSelection.ts
import type { WorkoutSelection } from "../state/createPostTypes";

type RpcTopItem = {
  exercise_id: string;
  exercise_name: string;
  summary: string; // e.g. "3 × 10"
};

type RpcItem = {
  workout_history_id: string;
  workout_id: string | null;
  title: string;
  completed_at: string;
  duration_seconds: number | null;
  volume_kg: number;
  sets_count: number;
  top_items: RpcTopItem[];
};

export function mapRpcItemToWorkoutSelection(
  item: RpcItem,
  unit: "kg" | "lb"
): WorkoutSelection {
  return {
    workoutHistoryId: item.workout_history_id,
    workoutId: item.workout_id ?? undefined,
    title: item.title ?? "Workout",
    completedAt: item.completed_at,
    durationSeconds: item.duration_seconds ?? null,

    totalVolume: item.volume_kg ?? 0,
    volumeUnit: unit,
    totalSets: item.sets_count ?? 0,

    topExercises: (item.top_items ?? []).slice(0, 3).map((x) => ({
      exerciseId: x.exercise_id,
      name: x.exercise_name,
      volume: null, // not provided by this RPC (fine for now)
    })),

    imageKey: null,
    imageUri: null,
  };
}