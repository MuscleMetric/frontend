// app/features/workouts/live/session/useActiveWorkoutSession.ts

import { useContext } from "react";
import { ActiveWorkoutSessionContext } from "./ActiveWorkoutSessionProvider";

export function useActiveWorkoutSession() {
  const ctx = useContext(ActiveWorkoutSessionContext);

  if (!ctx) {
    throw new Error(
      "useActiveWorkoutSession must be used within ActiveWorkoutSessionProvider",
    );
  }

  return ctx;
}