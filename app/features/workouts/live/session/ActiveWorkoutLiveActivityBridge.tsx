// app/features/workouts/live/session/ActiveWorkoutLiveActivityBridge.tsx

import React from "react";
import { useActiveWorkoutSession } from "./useActiveWorkoutSession";
import { useLiveActivitySync } from "../liveActivity/useLiveActivitySync";

export function ActiveWorkoutLiveActivityBridge() {
  const { activeDraft, hasActiveWorkout } = useActiveWorkoutSession();

  useLiveActivitySync(activeDraft, hasActiveWorkout);

  return null;
}