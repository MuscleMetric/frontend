// app/features/plans/editor/workoutEditorWrapper.tsx
import React, { useMemo, useCallback, useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";

import { useAuth } from "@/lib/authContext"; // adjust if your hook path differs
import { usePlanDraft } from "../create/store";
import type { WorkoutDraft } from "../create/store";

import PlanWorkoutEditor from "./workoutEditor"; // <-- your existing file (UNCHANGED)

const emptyWorkoutDraft = (i: number): WorkoutDraft => ({
  title: `Workout ${i + 1}`,
  notes: null,
  exercises: [],
});

function safeIndex(v: unknown) {
  const n = Number(String(v ?? "0"));
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export default function WorkoutEditorWrapperRoute() {
  const params = useLocalSearchParams();
  const index = useMemo(() => safeIndex(params.index), [params.index]);

  const { userId } = useAuth();

  const { workoutsPerWeek, workouts, ensureWorkouts, setWorkout } =
    usePlanDraft();

  // Ensure the workouts array always has the correct length
  useEffect(() => {
    ensureWorkouts(workoutsPerWeek);
  }, [ensureWorkouts, workoutsPerWeek]);

  const draft = useMemo(() => {
    const arr = Array.isArray(workouts) ? workouts : [];
    return arr[index] ?? emptyWorkoutDraft(index);
  }, [workouts, index]);

  const onChange = useCallback(
    (next: WorkoutDraft) => setWorkout(index, next),
    [index, setWorkout]
  );

  const onBack = useCallback(() => router.back(), []);
  const onNext = useCallback(() => router.back(), []); // go back to the workouts list step

  if (!userId) return null;

  return (
    <PlanWorkoutEditor
      userId={userId}
      workoutIndex={index}
      workoutsPerWeek={workoutsPerWeek}
      draft={draft}
      onChange={onChange}
      onBack={onBack}
      onNext={onNext}
      title="Build your week"
    />
  );
}
