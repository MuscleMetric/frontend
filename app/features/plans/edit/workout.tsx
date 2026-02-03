// app/features/plans/edit/workout.tsx
import React, { useMemo, useCallback } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/lib/authContext";
import { useEditPlan } from "./store";

// ✅ Shared editor you created
import PlanWorkoutEditor from "../editor/workoutEditor";

/**
 * The editor expects the "create" flow draft shape (WorkoutDraft / WorkoutExercise)
 * which includes target_* fields + notes.
 *
 * Your edit store draft is slimmer, so we adapt both directions.
 */

function toEditorDraft(draftFromEdit: any) {
  return {
    ...draftFromEdit,
    notes: draftFromEdit?.notes ?? null,
    exercises: (draftFromEdit?.exercises ?? []).map((e: any, idx: number) => ({
      ...e,
      order_index: typeof e.order_index === "number" ? e.order_index : idx,
      supersetGroup: e.supersetGroup ?? null,
      isDropset: !!e.isDropset,

      // fields the editor can edit (safe defaults)
      target_sets: e.target_sets ?? null,
      target_reps: e.target_reps ?? null,
      target_weight: e.target_weight ?? null,
      target_time_seconds: e.target_time_seconds ?? null,
      target_distance: e.target_distance ?? null,
      notes: e.notes ?? null,
    })),
  };
}

function fromEditorDraft(editorDraft: any) {
  return {
    ...editorDraft,
    // keep notes on the workout if you want to store it later
    // your current edit/store WorkoutDraft doesn't include notes, but zustand will still hold it
    notes: editorDraft?.notes ?? null,

    // return at least what update_full_plan expects today
    exercises: (editorDraft?.exercises ?? []).map((e: any, idx: number) => ({
      ...e,
      order_index: typeof e.order_index === "number" ? e.order_index : idx,
      supersetGroup: e.supersetGroup ?? null,
      isDropset: !!e.isDropset,

      // keep targets/notes in memory even if RPC ignores them for now
      target_sets: e.target_sets ?? null,
      target_reps: e.target_reps ?? null,
      target_weight: e.target_weight ?? null,
      target_time_seconds: e.target_time_seconds ?? null,
      target_distance: e.target_distance ?? null,
      notes: e.notes ?? null,
    })),
  };
}

export default function EditWorkoutScreen() {
  const router = useRouter();
  const { index } = useLocalSearchParams<{ index: string }>();

  const workoutIndex = Number(index ?? 0);

  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { workouts, workoutsPerWeek, setWorkout } = useEditPlan();

  const draft = workouts?.[workoutIndex];

  const editorDraft = useMemo(() => {
    if (!draft) return null;
    return toEditorDraft(draft);
  }, [draft]);

  const onChange = useCallback(
    (nextEditorDraft: any) => {
      const next = fromEditorDraft(nextEditorDraft);
      setWorkout(workoutIndex, next);
    },
    [setWorkout, workoutIndex]
  );

  // For edit flow: "Continue" should just return to the hub
  const onNext = useCallback(() => {
    // the editor already validates title + exercises before calling onNext,
    // but keeping this is harmless.
    if (!editorDraft?.title?.trim()) {
      Alert.alert("Add a workout title");
      return;
    }
    if (!(editorDraft?.exercises?.length ?? 0)) {
      Alert.alert("Add at least one exercise");
      return;
    }
    router.back();
  }, [router, editorDraft]);

  const onBack = useCallback(() => router.back(), [router]);

  // Guards
  if (!userId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!Number.isFinite(workoutIndex) || !draft || !editorDraft) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <PlanWorkoutEditor
      userId={userId}
      workoutIndex={workoutIndex}
      workoutsPerWeek={workoutsPerWeek || workouts.length || 1}
      draft={editorDraft}
      onChange={onChange}
      onBack={onBack}
      onNext={onNext}
      title="Edit workout"
    />
  );
}
