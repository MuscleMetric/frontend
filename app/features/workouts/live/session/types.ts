// app/features/workouts/live/session/types.ts

import type { LiveWorkoutDraft } from "../state/types";

export type ActiveWorkoutSessionContextValue = {
  activeDraft: LiveWorkoutDraft | null;
  hasActiveWorkout: boolean;
  elapsedSeconds: number;
  timerText: string;
  loading: boolean;
  refresh: () => Promise<void>;
  clearSnapshot: () => void;
  resumeWorkout: () => void;
  shouldShowResumeGate: boolean;
  dismissResumeGate: () => void;
};