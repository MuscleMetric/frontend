// app/features/workouts/live/modals/ExerciseEntryModal.tsx
import React from "react";
import type { LiveWorkoutDraft } from "../../hooks/liveWorkoutTypes";
import { ExerciseEntrySheet } from "../components/ExerciseEntrySheet";

export function ExerciseEntryModal(props: {
  visible: boolean;
  onClose: () => void;
  draft: LiveWorkoutDraft;
  setDraft: (next: LiveWorkoutDraft) => Promise<void>;

  onUpdateSetValue: (args: {
    exerciseIndex: number;
    setNumber: number;
    field: "reps" | "weight" | "timeSeconds" | "distance";
    value: number | null;
  }) => void;

  onAddSet: (exerciseIndex: number) => void;
  onRemoveSet: (exerciseIndex: number) => void;
  onPrevSet: () => void;
  onNextSet: () => void;

  onSwapExercise: () => void;
}) {
  return <ExerciseEntrySheet {...props} />;
}
