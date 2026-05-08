// app/features/workouts/logging/exerciseLoggingProfile.ts

export type LoggingType =
  | "strength"
  | "bodyweight"
  | "bodyweight_weighted"
  | "timed"
  | "timed_weighted"
  | "cardio"
  | "assisted";

export type ExerciseLoggingProfile = {
  loggingType: LoggingType;

  supportsWeight: boolean;
  supportsReps: boolean;
  supportsTime: boolean;
  supportsDistance: boolean;
  supportsAssistance: boolean;

  canComputeVolume: boolean;
  canComputeE1rm: boolean;
  canShowDropset: boolean;
};

type ExerciseLike = {
  name?: string | null;
  type?: string | null;
  equipment?: string | null;
};

const TIMED_EXERCISE_NAMES = [
  "plank",
  "side plank",
  "dead hang",
  "wall sit",
  "l-sit",
  "hollow hold",
  "superman hold",
];

const BODYWEIGHT_KEYWORDS = [
  "push-up",
  "push up",
  "pull-up",
  "pull up",
  "chin-up",
  "chin up",
  "dip",
  "burpee",
  "sit-up",
  "sit up",
  "crunch",
  "mountain climber",
];

const ASSISTED_KEYWORDS = [
  "assisted pull-up",
  "assisted pull up",
  "assisted dip",
];

function includesKeyword(value: string, keywords: string[]) {
  return keywords.some((k) => value.includes(k));
}

export function getLoggingType(
  exercise: ExerciseLike,
): LoggingType {
  const name = (exercise.name ?? "").toLowerCase();
  const type = (exercise.type ?? "").toLowerCase();
  const equipment = (exercise.equipment ?? "").toLowerCase();

  // Cardio
  if (type === "cardio") {
    return "cardio";
  }

  // Timed movements
  if (includesKeyword(name, TIMED_EXERCISE_NAMES)) {
    return "timed";
  }

  // Assisted exercises
  if (includesKeyword(name, ASSISTED_KEYWORDS)) {
    return "assisted";
  }

  // Bodyweight equipment
  if (
    equipment.includes("bodyweight") ||
    equipment.includes("body only")
  ) {
    return "bodyweight_weighted";
  }

  // Bodyweight keyword fallback
  if (includesKeyword(name, BODYWEIGHT_KEYWORDS)) {
    return "bodyweight";
  }

  // Default
  return "strength";
}

export function getExerciseLoggingProfile(
  exercise: ExerciseLike,
): ExerciseLoggingProfile {
  const loggingType = getLoggingType(exercise);

  switch (loggingType) {
    case "cardio":
      return {
        loggingType,
        supportsWeight: false,
        supportsReps: false,
        supportsTime: true,
        supportsDistance: true,
        supportsAssistance: false,
        canComputeVolume: false,
        canComputeE1rm: false,
        canShowDropset: false,
      };

    case "timed":
      return {
        loggingType,
        supportsWeight: false,
        supportsReps: false,
        supportsTime: true,
        supportsDistance: false,
        supportsAssistance: false,
        canComputeVolume: false,
        canComputeE1rm: false,
        canShowDropset: false,
      };

    case "timed_weighted":
      return {
        loggingType,
        supportsWeight: true,
        supportsReps: false,
        supportsTime: true,
        supportsDistance: false,
        supportsAssistance: false,
        canComputeVolume: false,
        canComputeE1rm: false,
        canShowDropset: false,
      };

    case "bodyweight":
      return {
        loggingType,
        supportsWeight: false,
        supportsReps: true,
        supportsTime: false,
        supportsDistance: false,
        supportsAssistance: false,
        canComputeVolume: false,
        canComputeE1rm: false,
        canShowDropset: false,
      };

    case "bodyweight_weighted":
      return {
        loggingType,
        supportsWeight: true,
        supportsReps: true,
        supportsTime: false,
        supportsDistance: false,
        supportsAssistance: false,
        canComputeVolume: true,
        canComputeE1rm: false,
        canShowDropset: false,
      };

    case "assisted":
      return {
        loggingType,
        supportsWeight: true,
        supportsReps: true,
        supportsTime: false,
        supportsDistance: false,
        supportsAssistance: true,
        canComputeVolume: false,
        canComputeE1rm: false,
        canShowDropset: false,
      };

    case "strength":
    default:
      return {
        loggingType: "strength",
        supportsWeight: true,
        supportsReps: true,
        supportsTime: false,
        supportsDistance: false,
        supportsAssistance: false,
        canComputeVolume: true,
        canComputeE1rm: true,
        canShowDropset: true,
      };
  }
}