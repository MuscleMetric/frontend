// ui/media/workoutCovers.ts
export type WorkoutImageKey =
  | "cardio"
  | "push"
  | "pull"
  | "legs"
  | "lower_body"
  | "upper_body"
  | "full_body";

export const WORKOUT_COVERS: Record<WorkoutImageKey, any> = {
  cardio: require("@/assets/workout_images/Cardio.png"),
  push: require("@/assets/workout_images/Push.png"),
  pull: require("@/assets/workout_images/Pull.png"),
  legs: require("@/assets/workout_images/Legs.png"),
  lower_body: require("@/assets/workout_images/LowerBody.png"),
  upper_body: require("@/assets/workout_images/UpperBody.png"),
  full_body: require("@/assets/workout_images/FullBody.png"),
};

export function resolveWorkoutCover(key?: string | null) {
  const k = (key ?? "").toLowerCase() as WorkoutImageKey;
  return WORKOUT_COVERS[k] ?? WORKOUT_COVERS.full_body;
}
