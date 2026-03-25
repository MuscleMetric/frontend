import { makeDraftId } from "../../hooks/buildDraft";
import type { LiveWorkoutDraft } from "../../hooks/liveWorkoutTypes";

export function buildEmptyQuickStartDraft(args: {
  userId: string;
}): LiveWorkoutDraft {
  const now = new Date().toISOString();

  return {
    draftId: makeDraftId(),
    userId: args.userId,

    workoutId: null,
    planWorkoutId: null,
    isPlanWorkout: false,

    source: "quick_start",

    title: "Quick Start Workout",
    notes: null,
    imageKey: null,

    headerStats: {
      avgDurationSeconds: null,
      avgTotalVolume: null,
      lastCompletedAt: null,
    },

    goals: [],

    startedAt: now,
    updatedAt: now,

    exercises: [],

    ui: {
      activeExerciseIndex: 0,
      activeSetNumber: 1,
    },

    timerRuntimeId: null,
    timerElapsedSeconds: 0,
    timerLastActiveAt: now,
  };
}