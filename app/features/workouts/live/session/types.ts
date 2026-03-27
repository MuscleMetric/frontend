// app/features/workouts/live/session/types.ts

export type ActiveWorkoutSnapshot = {
  draftId: string;
  userId: string;
  workoutId?: string | null;
  planWorkoutId?: string | null;
  title?: string | null;
  startedAt?: string | null;
  updatedAt?: string | null;
  timerElapsedSeconds?: number | null;
  timerLastActiveAt?: string | null;
};

export type ActiveWorkoutSessionContextValue = {
  activeWorkout: ActiveWorkoutSnapshot | null;
  hasActiveWorkout: boolean;
  elapsedSeconds: number;
  timerText: string;
  loading: boolean;
  refresh: () => Promise<void>;
  clearSnapshot: () => void;
  resumeWorkout: () => void;
};