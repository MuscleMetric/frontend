// ui/media/fullWorkoutImages.ts
export type FullWorkoutImageKey =
  | "cardio"
  | "push"
  | "pull"
  | "legs"
  | "lower_body"
  | "upper_body"
  | "full_body";

export const FULL_WORKOUT_IMAGES: Record<FullWorkoutImageKey, any> = {
  cardio: require("@/assets/full_workout_images/cardio.png"),
  push: require("@/assets/full_workout_images/push.png"),
  pull: require("@/assets/full_workout_images/pull.png"),
  legs: require("@/assets/full_workout_images/legs.png"),
  lower_body: require("@/assets/full_workout_images/lower_body.png"),
  upper_body: require("@/assets/full_workout_images/upper_body.png"),
  full_body: require("@/assets/full_workout_images/full_body.png"),
};

export function resolveFullWorkoutImage(key?: string | null) {
  const k = (key ?? "").toLowerCase() as FullWorkoutImageKey;
  return FULL_WORKOUT_IMAGES[k] ?? FULL_WORKOUT_IMAGES.full_body;
}
