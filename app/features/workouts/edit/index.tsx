// app/features/workouts/edit/index.tsx
import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/authContext";

import WorkoutEditorScreen from "../editor/WorkoutEditorScreen";
import useWorkoutDraft from "../create/state/useWorkoutDraft";
import { nowIso, snapshotHash } from "../create/state/helpers";
import type { WorkoutDraft } from "../create/state/types";

type RouteParams = { workoutId?: string };

export default function EditWorkoutRoute() {
  const { workoutId } = useLocalSearchParams<RouteParams>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const didHydrateRef = useRef(false);

  const draftId = useMemo(
    () => `edit_workout_${String(workoutId ?? "")}`,
    [workoutId]
  );

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

    // must exist for edit hydration
    hydrateDraft,
  } = useWorkoutDraft(draftId) as any;

  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    didHydrateRef.current = false;
  }, [workoutId]);

  useEffect(() => {
    if (!workoutId) return;
    if (!userId) return;

    // ✅ prevent overwriting local edits on rerender
    if (didHydrateRef.current) return;

    let cancelled = false;

    async function load() {
      setHydrating(true);

      try {
        const { data: w, error: wErr } = await supabase
          .from("workouts")
          .select("id,title,notes,workout_image_key")
          .eq("id", String(workoutId))
          .single();

        if (wErr) throw wErr;

        const { data: we, error: weErr } = await supabase
          .from("workout_exercises")
          .select(
            "id,exercise_id,order_index,notes,is_dropset,superset_group,superset_index,exercises(name)"
          )
          .eq("workout_id", String(workoutId))
          .order("order_index", { ascending: true });

        if (weErr) throw weErr;

        const now = nowIso();

        const nextDraft: WorkoutDraft = {
          id: draftId,
          title: String(w?.title ?? ""),
          note: w?.notes ?? null,
          createdAtIso: now,
          updatedAtIso: now,
          lastSavedSnapshotHash: null,
          exercises: (we ?? []).map((row: any) => ({
            key: String(row.id),
            exerciseId: String(row.exercise_id),
            name: String(
              row?.exercises?.name ?? row?.exercise?.name ?? "Exercise"
            ),
            note: row?.notes ?? null,
            isFavourite: false,

            isDropset: !!row?.is_dropset,
            supersetGroup: row?.superset_group
              ? String(row.superset_group).toUpperCase()
              : null,
            supersetIndex:
              row?.superset_index === 0 || row?.superset_index
                ? Number(row.superset_index)
                : null,
          })),
        };

        nextDraft.lastSavedSnapshotHash = snapshotHash(nextDraft);

        if (!cancelled) {
          didHydrateRef.current = true; // ✅ lock before hydrate
          hydrateDraft(nextDraft);
        }
      } catch (e: any) {
        console.warn("edit workout hydrate error:", e);
        Alert.alert("Couldn’t load workout", e?.message ?? "Please try again.");
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [workoutId, userId, draftId, hydrateDraft]);

  const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );

  const onSave = useCallback(
    async (draftToSave: WorkoutDraft, mode: "save" | "save_start") => {
      if (!userId) throw new Error("auth_missing");
      if (!workoutId) throw new Error("workout_id_missing");

      const payload = {
        workout_id: String(workoutId),
        title: String(draftToSave.title ?? "").trim(),
        notes: draftToSave.note ? String(draftToSave.note).trim() : null,
        exercises: (draftToSave.exercises ?? []).map((ex, idx) => ({
          id: isUuid(ex.key) ? ex.key : null,
          exercise_id: ex.exerciseId,
          order_index: idx,
          notes: ex.note ?? null,
          is_dropset: !!ex.isDropset,
          superset_group: ex.supersetGroup,
          superset_index: ex.supersetIndex,
        })),
      };

      const { data, error } = await supabase.rpc("update_workout_v1", {
        p_workout: payload,
      });

      if (error) throw error;

      return { workoutId: String(data ?? workoutId) };
    },
    [userId, workoutId]
  );

  const onDelete = useCallback(async () => {
    if (!userId) throw new Error("auth_missing");
    if (!workoutId) throw new Error("workout_id_missing");

    const { error } = await supabase.rpc("delete_workout_v1", {
      p_workout_id: String(workoutId),
    });

    if (error) throw error;

    router.replace({
      pathname: "/(tabs)/workout",
    } as any);
  }, [userId, workoutId]);

  if (!userId) return null;

  // You can choose to block rendering while hydrating;
  // leaving it visible is fine but user may see empty then pop in.
  if (hydrating) {
    return (
      <WorkoutEditorScreen
        mode="edit"
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
        onDelete={onDelete}
        onAfterSave={({ workoutId }, mode) => {
          if (mode === "save_start") {
            router.replace({
              pathname: "/features/workouts/live",
              params: { workoutId },
            } as any);
          } else {
            router.replace({
              pathname: "/features/workouts",
            } as any);
          }
        }}
      />
    );
  }

  return (
    <WorkoutEditorScreen
      mode="edit"
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
      onDelete={onDelete}
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
