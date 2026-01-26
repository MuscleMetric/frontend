// app/features/workouts/create/index.tsx
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Alert } from "react-native";
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

import { AddExercisesSheet, ExerciseNoteSheet, DiscardChangesSheet } from "./modals";

type RouteParams = { draftId?: string };

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
    removeExercise,
    reorderExercises,
    toggleFavourite,
    setExerciseNote,
    markSavedNow,
  } = useWorkoutDraft(String(draftId ?? "create_workout"));

  const [saving, setSaving] = useState(false);

  // modals
  const [addOpen, setAddOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteExerciseId, setNoteExerciseId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const isDirty = useMemo(() => {
    const current = snapshotHash(draft as any);
    const saved =
      (draft as any).savedSnapshotHash ??
      (draft as any).snapshot_hash ??
      (draft as any).snapshotHash ??
      null;

    return saved ? current !== saved : true;
  }, [draft]);

  const canSave = useMemo(() => {
    const hasTitle = String((draft as any).title ?? "").trim().length > 0;
    const hasExercises = Array.isArray((draft as any).exercises) && (draft as any).exercises.length > 0;
    return hasTitle && hasExercises && !saving;
  }, [draft, saving]);

  const onBack = useCallback(() => {
    if (isDirty) setDiscardOpen(true);
    else router.back();
  }, [isDirty]);

  const discardAndExit = useCallback(() => {
    setDiscardOpen(false);
    router.back();
  }, []);

  const openExerciseNote = useCallback((exerciseId: string) => {
    setNoteExerciseId(exerciseId);
    setNoteOpen(true);
  }, []);

  const noteExerciseName = useMemo(() => {
    if (!noteExerciseId) return "";
    const it = (draft as any).exercises?.find((x: any) => String(x.exerciseId) === String(noteExerciseId));
    return String(it?.name ?? "Exercise");
  }, [draft, noteExerciseId]);

  const noteInitial = useMemo(() => {
    if (!noteExerciseId) return "";
    const it = (draft as any).exercises?.find((x: any) => String(x.exerciseId) === String(noteExerciseId));
    return String(it?.note ?? "");
  }, [draft, noteExerciseId]);

  const selectedIds = useMemo(
    () => ((draft as any).exercises ?? []).map((x: any) => String(x.exerciseId)),
    [draft]
  );

  const saveWorkout = useCallback(
    async (mode: "save" | "save_start") => {
      if (!userId) {
        Alert.alert("Not signed in", "Please sign in to create workouts.");
        return;
      }

      const title = String((draft as any).title ?? "").trim();
      if (!title) {
        Alert.alert("Workout name required", "Give your workout a name.");
        return;
      }

      const exercises = Array.isArray((draft as any).exercises) ? (draft as any).exercises : [];
      if (!exercises.length) {
        Alert.alert("Add exercises", "Add at least one exercise.");
        return;
      }

      setSaving(true);
      try {
        const notes = String((draft as any).note ?? "").trim();

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
        }));

        const { error: weErr } = await supabase.from("workout_exercises").insert(rows);
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

  return (
    <Screen>
      {/* IMPORTANT: wire back handler */}
      <ScreenHeader title="Create workout" showBack={true} />

      <View
        style={{
          paddingHorizontal: layout.space.md,
          paddingBottom: layout.space.xl,
          gap: layout.space.md,
          flex: 1,
          backgroundColor: colors.bg,
        }}
      >
        <Card>
          <View style={{ gap: layout.space.md }}>
            <CreateWorkoutHeader />
            <WorkoutNameInput value={String((draft as any).title ?? "")} onChange={setTitle} />
            <WorkoutNotesCard value={String((draft as any).note ?? "")} onChange={setNote} />
          </View>
        </Card>

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
                {((draft as any).exercises ?? []).length}
              </Text>
            </View>

            {((draft as any).exercises ?? []).length ? (
              <ExerciseList
                items={(draft as any).exercises}
                onAdd={() => setAddOpen(true)}
                onRemove={(exerciseId) => removeExercise(exerciseId)}
                onToggleFavourite={(exerciseId) => toggleFavourite(exerciseId)}
                onOpenNote={(exerciseId) => openExerciseNote(exerciseId)}
                // drag handle wiring comes later when you add DnD library
                renderDragHandle={undefined}
              />
            ) : (
              <EmptyExercisesState onAdd={() => setAddOpen(true)} />
            )}
          </View>
        </Card>

        <View style={{ gap: layout.space.sm, marginTop: "auto" }}>
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
      </View>

      {/* Modals */}
      <AddExercisesSheet
        visible={addOpen}
        userId={String(userId ?? "")}
        selectedIds={selectedIds}
        onClose={() => setAddOpen(false)}
        onDone={(nextSelectedIds: string[]) => {
          // Add only the newly selected exercises.
          // NOTE: We only have IDs here. Either:
          // 1) adjust AddExercisesSheet to return {id,name} objects, OR
          // 2) fetch names by IDs here.
          //
          // Quick fix: fetch names by ids from `exercises` table.
          (async () => {
            const next = new Set(nextSelectedIds);
            const prev = new Set(selectedIds);
            const added = Array.from(next).filter((id) => !prev.has(id));

            if (!added.length) return;

            const { data, error } = await supabase
              .from("exercises")
              .select("id, name")
              .in("id", added);

            if (error) {
              console.warn("load names for added exercises error:", error);
              return;
            }

            const items = (data ?? []).map((r: any) => ({
              exerciseId: String(r.id),
              name: String(r.name ?? "Exercise"),
            }));

            addExercises(items);
          })().catch((e) => console.warn(e));
        }}
      />

      <ExerciseNoteSheet
        visible={noteOpen}
        exerciseName={noteExerciseName}
        initialNote={noteInitial}
        onClose={() => {
          setNoteOpen(false);
          setNoteExerciseId(null);
        }}
        onApply={(note: string) => {
          if (!noteExerciseId) return;
          setExerciseNote(noteExerciseId, note);
          setNoteOpen(false);
          setNoteExerciseId(null);
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
