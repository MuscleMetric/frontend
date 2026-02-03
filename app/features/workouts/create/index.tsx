// app/features/workouts/create/index.tsx
import React, { useCallback } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/authContext";

import WorkoutEditorScreen from "../editor/WorkoutEditorScreen";
import useWorkoutDraft from "./state/useWorkoutDraft";
import type { WorkoutDraft } from "./state/types";

type RouteParams = { draftId?: string };

export default function CreateWorkoutRoute() {
  const { draftId } = useLocalSearchParams<RouteParams>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const {
    draft,
    setTitle,
    setNote,
    addExercises,

    removeExercise,
    toggleFavourite,
    setExerciseNote,

    toggleDropset,
    setSupersetGroup,

    markSavedNow,
  } = useWorkoutDraft(String(draftId ?? "create_workout")) as any;

  const onSave = useCallback(
    async (draftToSave: WorkoutDraft, mode: "save" | "save_start") => {
      if (!userId) {
        Alert.alert("Not signed in", "Please sign in to create workouts.");
        throw new Error("auth_missing");
      }

      const payload = {
        title: String(draftToSave.title ?? "").trim(),
        notes: draftToSave.note ? String(draftToSave.note).trim() : null,
        exercises: (draftToSave.exercises ?? []).map((ex, idx) => ({
          exercise_id: ex.exerciseId,
          order_index: idx,
          notes: ex.note ?? null,
          is_dropset: !!ex.isDropset,
          superset_group: ex.supersetGroup,
          superset_index: ex.supersetIndex,
        })),
      };

      const { data, error } = await supabase.rpc("create_workout_v1", {
        p_workout: payload,
      });

      if (error) throw error;

      return { workoutId: String(data) };
    },
    [userId]
  );

  // If not signed in, you can still render the editor (save will block),
  // but passing empty userId would break AddExercisesSheet props.
  if (!userId) {
    // keep it simple + explicit
    return null;
  }

  return (
    <WorkoutEditorScreen
      mode="create"
      userId={String(userId)}
      draft={draft}

      setTitle={setTitle}
      setNote={setNote}
      addExercises={addExercises}

      removeExercise={removeExercise}
      toggleFavourite={toggleFavourite}
      setExerciseNote={setExerciseNote}

      toggleDropset={toggleDropset}
      setSupersetGroup={setSupersetGroup}

      markSavedNow={markSavedNow}
      onSave={onSave}
      onAfterSave={({ workoutId }, mode) => {
        if (mode === "save_start") {
          router.replace({
            pathname: "/features/workouts/live",
            params: { workoutId },
          } as any);
        } else {
          router.back();
        }
      }}
    />
  );
}
