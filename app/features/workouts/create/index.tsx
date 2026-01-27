// app/features/workouts/create/index.tsx
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";

import { Screen, ScreenHeader, Card, Button } from "@/ui";

import useWorkoutDraft from "./state/useWorkoutDraft";
import { snapshotHash } from "./state/helpers";

import CreateWorkoutHeader from "./ui/CreateWorkoutHeader";
import WorkoutNameInput from "./ui/WorkoutNameInput";
import WorkoutNotesCard from "./ui/WorkoutNotesCard";
import ExerciseList from "./ui/ExerciseList";
import EmptyExercisesState from "./ui/EmptyExercisesState";

import {
  AddExercisesSheet,
  ExerciseNoteSheet,
  DiscardChangesSheet,
  SupersetSheet,
} from "./modals";

type RouteParams = {
  draftId?: string;
};

export default function CreateWorkoutScreen() {
  const { draftId } = useLocalSearchParams<RouteParams>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, layout } = useAppTheme();

  const {
    draft,
    setTitle,
    setNote,
    addExercises,

    // IMPORTANT: these now operate on exerciseKey (not exerciseId)
    removeExercise,
    toggleFavourite,
    setExerciseNote,

    // NEW: you said you’re adding these into state
    toggleDropset,
    setSupersetGroup,

    markSavedNow,
  } = useWorkoutDraft(String(draftId ?? "create_workout")) as any;

  const [saving, setSaving] = useState(false);

  // modals
  const [addOpen, setAddOpen] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteExerciseKey, setNoteExerciseKey] = useState<string | null>(null);

  const [supersetOpen, setSupersetOpen] = useState(false);
  const [supersetExerciseKey, setSupersetExerciseKey] = useState<string | null>(
    null
  );

  const [discardOpen, setDiscardOpen] = useState(false);

  const isDirty = useMemo(() => {
    const current = snapshotHash(draft);
    const saved =
      (draft as any).lastSavedSnapshotHash ??
      (draft as any).savedSnapshotHash ??
      (draft as any).snapshot_hash ??
      (draft as any).snapshotHash ??
      null;

    return saved ? current !== saved : true;
  }, [draft]);

  const canSave = useMemo(() => {
    const hasTitle = String(draft.title ?? "").trim().length > 0;
    const hasExercises = (draft.exercises ?? []).length > 0;
    return hasTitle && hasExercises && !saving;
  }, [draft.title, draft.exercises, saving]);

  const onBack = useCallback(() => {
    if (isDirty) setDiscardOpen(true);
    else router.back();
  }, [isDirty]);

  const discardAndExit = useCallback(() => {
    setDiscardOpen(false);
    router.back();
  }, []);

  // --- helpers to locate the draft row by key ---
  const findByKey = useCallback(
    (exerciseKey: string) =>
      (draft.exercises ?? []).find((x: any) => String(x.key) === exerciseKey) ??
      null,
    [draft.exercises]
  );

  const openExerciseNote = useCallback((exerciseKey: string) => {
    setNoteExerciseKey(exerciseKey);
    setNoteOpen(true);
  }, []);

  const openSuperset = useCallback((exerciseKey: string) => {
    setSupersetExerciseKey(exerciseKey);
    setSupersetOpen(true);
  }, []);

  const saveWorkout = useCallback(
    async (mode: "save" | "save_start") => {
      if (!userId) {
        Alert.alert("Not signed in", "Please sign in to create workouts.");
        return;
      }

      const title = String(draft.title ?? "").trim();
      if (!title) {
        Alert.alert("Workout name required", "Give your workout a name.");
        return;
      }

      const exercises = Array.isArray(draft.exercises) ? draft.exercises : [];
      if (!exercises.length) {
        Alert.alert("Add exercises", "Add at least one exercise.");
        return;
      }

      setSaving(true);
      try {
        const notes = String(draft.note ?? "").trim();

        const { data: wIns, error: wErr } = await supabase
          .from("workouts")
          .insert({
            user_id: userId,
            title,
            notes: notes.length ? notes : null,
          })
          .select("id")
          .single();

        if (wErr) throw wErr;

        const workoutId = String(wIns?.id);

        const rows = exercises.map((ex: any, idx: number) => ({
          workout_id: workoutId,
          exercise_id: String(ex.exerciseId),
          order_index: idx,
          note: ex.note ? String(ex.note) : null,
          is_favourite: !!ex.isFavourite,

          // NEW: carry these through now so your future save RPC can use them
          is_dropset: !!ex.isDropset,
          superset_group: ex.supersetGroup ? String(ex.supersetGroup) : null,
          superset_index:
            ex.supersetIndex === 0 || ex.supersetIndex
              ? Number(ex.supersetIndex)
              : null,
        }));

        const { error: weErr } = await supabase
          .from("workout_exercises")
          .insert(rows);
        if (weErr) throw weErr;

        markSavedNow();

        if (mode === "save_start") {
          router.replace({
            pathname: "/features/workouts/live",
            params: { workoutId },
          } as any);
        } else {
          router.back();
        }
      } catch (e: any) {
        console.warn("create workout save error:", e);
        Alert.alert("Couldn’t save workout", e?.message ?? "Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [userId, draft, markSavedNow]
  );

  // IMPORTANT: selection should be based on exerciseId (for picker), but draft actions use key
  const selectedExerciseIds = useMemo(
    () => (draft.exercises ?? []).map((x: any) => String(x.exerciseId)),
    [draft.exercises]
  );

  // For SupersetSheet label + current group
  const supersetRow = useMemo(() => {
    if (!supersetExerciseKey) return null;
    return findByKey(supersetExerciseKey);
  }, [supersetExerciseKey, findByKey]);

  // For Note sheet label + initial note
  const noteRow = useMemo(() => {
    if (!noteExerciseKey) return null;
    return findByKey(noteExerciseKey);
  }, [noteExerciseKey, findByKey]);

  return (
    <Screen>
      {/* If your ScreenHeader supports onBack, wire it. If not, keep showBack={true}. */}
      <ScreenHeader title="Create workout" showBack={true} />

      {/* Whole screen scrolls */}
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingHorizontal: layout.space.md,
          paddingTop: layout.space.md,
          paddingBottom: layout.space.xxl,
          gap: layout.space.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top */}
        <Card>
          <View style={{ gap: layout.space.md }}>
            <CreateWorkoutHeader />
            <WorkoutNameInput
              value={String(draft.title ?? "")}
              onChange={setTitle}
            />
            <WorkoutNotesCard
              value={String(draft.note ?? "")}
              onChange={setNote}
            />
          </View>
        </Card>

        {/* Exercises */}
        <Card>
          <View style={{ gap: layout.space.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                Exercises
              </Text>

              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {(draft.exercises ?? []).length}
              </Text>
            </View>

            {(draft.exercises ?? []).length ? (
              <ExerciseList
                items={draft.exercises as any}
                onAdd={() => setAddOpen(true)}
                onRemove={(exerciseKey: string) => removeExercise(exerciseKey)}
                onToggleFavourite={(exerciseKey: string) =>
                  toggleFavourite(exerciseKey)
                }
                onToggleDropset={(exerciseKey: string) =>
                  toggleDropset?.(exerciseKey)
                }
                onOpenSuperset={(exerciseKey: string) =>
                  openSuperset(exerciseKey)
                }
                onOpenNote={(exerciseKey: string) =>
                  openExerciseNote(exerciseKey)
                }
              />
            ) : (
              <EmptyExercisesState onAdd={() => setAddOpen(true)} />
            )}
          </View>
        </Card>

        {/* Actions */}
        <View style={{ gap: layout.space.sm }}>
          <Button
            title={saving ? "Saving..." : "Save & start"}
            onPress={() => saveWorkout("save_start")}
            disabled={!canSave}
          />
          <Button
            title={saving ? "Saving..." : "Save workout"}
            onPress={() => saveWorkout("save")}
            disabled={!canSave}
            variant="secondary"
          />
        </View>
      </ScrollView>

      {/* Modals */}
      <AddExercisesSheet
        visible={addOpen}
        userId={String(userId ?? "")}
        selectedIds={selectedExerciseIds}
        onClose={() => setAddOpen(false)}
        onDone={(pickedIds: string[]) => {
          // IMPORTANT: ensure names are present.
          // Your AddExercisesSheet already has items (ExerciseListItem) internally.
          // Best pattern: change AddExercisesSheet to call onDone(items: {id,name}[]) instead.
          // For now, keep backward-compatible: we’ll fill names lazily if missing.
          addExercises(pickedIds.map((id) => ({ exerciseId: id, name: "" })));
          setAddOpen(false);
        }}
        enableMuscleFilter
        enableEquipmentFilter
      />

      <ExerciseNoteSheet
        visible={noteOpen}
        exerciseName={String(noteRow?.name ?? "Exercise")}
        initialNote={noteRow?.note ?? ""}
        onClose={() => {
          setNoteOpen(false);
          setNoteExerciseKey(null);
        }}
        onApply={(note: string) => {
          if (!noteExerciseKey) return;
          setExerciseNote(noteExerciseKey, note);
          setNoteOpen(false);
          setNoteExerciseKey(null);
        }}
      />

      <SupersetSheet
        visible={supersetOpen}
        exerciseName={String(supersetRow?.name ?? "Exercise")}
        currentGroup={(supersetRow?.supersetGroup as any) ?? null}
        onClose={() => {
          setSupersetOpen(false);
          setSupersetExerciseKey(null);
        }}
        onPickGroup={(group: string | null) => {
          if (!supersetExerciseKey) return;
          setSupersetGroup?.(supersetExerciseKey, group);
          setSupersetOpen(false);
          setSupersetExerciseKey(null);
        }}
      />

      <DiscardChangesSheet
        visible={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscard={discardAndExit}
      />
    </Screen>
  );
}
