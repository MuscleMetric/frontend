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
  SupersetPickExercisesSheet,
} from "./modals";

type RouteParams = { draftId?: string };

// helper: existing groups + next letter
function getExistingGroups(exercises: any[]) {
  const set = new Set<string>();
  (exercises ?? []).forEach((x) => {
    const g = x?.supersetGroup ? String(x.supersetGroup).toUpperCase() : null;
    if (g) set.add(g);
  });
  return Array.from(set).sort();
}

function nextGroupLetter(existing: string[]) {
  const used = new Set(existing.map((g) => g.toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode("A".charCodeAt(0) + i);
    if (!used.has(c)) return c;
  }
  return "A";
}

/**
 * Minimal placeholder. Swap this to your real logic later.
 * Options:
 * - use draft.workoutImageKey when you add it
 * - infer from majority muscle/equipment once you have that data here
 */
function inferWorkoutImageKey(draft: any): string {
  // crude fallback: if title contains keywords
  const t = String(draft?.title ?? "").toLowerCase();
  if (t.includes("leg")) return "legs";
  if (t.includes("pull") || t.includes("back")) return "pull";
  if (t.includes("push") || t.includes("chest")) return "push";
  if (t.includes("upper")) return "upper_body";
  if (t.includes("lower")) return "lower_body";
  if (t.includes("cardio") || t.includes("run")) return "cardio";
  return "full_body";
}

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

    // keyed actions (exerciseKey)
    removeExercise,
    toggleFavourite,
    setExerciseNote,

    toggleDropset,
    setSupersetGroup,

    markSavedNow,
  } = useWorkoutDraft(String(draftId ?? "create_workout")) as any;

  const [saving, setSaving] = useState(false);

  // modals
  const [addOpen, setAddOpen] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteExerciseKey, setNoteExerciseKey] = useState<string | null>(null);

  // Superset flow (Option B)
  const [supersetOpen, setSupersetOpen] = useState(false);
  const [pickSupersetOpen, setPickSupersetOpen] = useState(false);

  const [pendingAnchorKey, setPendingAnchorKey] = useState<string | null>(null);
  const [pendingSupersetGroup, setPendingSupersetGroup] = useState<string | null>(null);
  const [requirePartner, setRequirePartner] = useState(false);

  const [discardOpen, setDiscardOpen] = useState(false);

  // dirty check
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

  const discardAndExit = useCallback(() => {
    setDiscardOpen(false);
    router.back();
  }, []);

  // locate draft row by key
  const findByKey = useCallback(
    (exerciseKey: string) =>
      (draft.exercises ?? []).find((x: any) => String(x.key) === exerciseKey) ?? null,
    [draft.exercises]
  );

  // Note sheet open
  const openExerciseNote = useCallback((exerciseKey: string) => {
    setNoteExerciseKey(exerciseKey);
    setNoteOpen(true);
  }, []);

  // Superset open (start at group picker)
  const openSuperset = useCallback((exerciseKey: string) => {
    setPendingAnchorKey(exerciseKey);
    setPendingSupersetGroup(null);
    setRequirePartner(false);
    setSupersetOpen(true);
  }, []);

  // groups for SupersetSheet
  const existingGroups = useMemo(
    () => getExistingGroups(draft.exercises ?? []),
    [draft.exercises]
  );

  const suggestedNewGroup = useMemo(
    () => nextGroupLetter(existingGroups),
    [existingGroups]
  );

  // ✅ Save via RPC
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
        const workoutImageKey = inferWorkoutImageKey(draft);

        const p_workout = {
          title,
          notes: notes.length ? notes : null,
          workout_image_key: workoutImageKey,

          exercises: exercises.map((ex: any, idx: number) => ({
            exercise_id: String(ex.exerciseId),
            order_index: idx,

            // IMPORTANT: workout_exercises column is "notes" not "note"
            notes: ex.note ? String(ex.note) : null,

            is_dropset: !!ex.isDropset,
            superset_group: ex.supersetGroup ? String(ex.supersetGroup).toUpperCase() : null,
            superset_index:
              ex.supersetIndex === 0 || ex.supersetIndex ? Number(ex.supersetIndex) : null,
          })),
        };

        const { data, error } = await supabase.rpc("create_workout_v1", { p_workout });
        if (error) throw error;

        const workoutId = String(data);
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

  // picker selection uses exerciseId (not key)
  const selectedExerciseIds = useMemo(
    () => (draft.exercises ?? []).map((x: any) => String(x.exerciseId)),
    [draft.exercises]
  );

  const noteRow = useMemo(() => {
    if (!noteExerciseKey) return null;
    return findByKey(noteExerciseKey);
  }, [noteExerciseKey, findByKey]);

  const anchorRow = useMemo(() => {
    if (!pendingAnchorKey) return null;
    return findByKey(pendingAnchorKey);
  }, [pendingAnchorKey, findByKey]);

  // items for “pick partner exercises” (ONLY current workout exercises)
  const pickItems = useMemo(() => {
    return (draft.exercises ?? []).map((x: any) => ({
      key: String(x.key),
      name: String(x.name ?? ""),
      supersetGroup: x.supersetGroup ? String(x.supersetGroup).toUpperCase() : null,
    }));
  }, [draft.exercises]);

  return (
    <Screen>
      <ScreenHeader title="Create Workout" showBack={true} />

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
            <WorkoutNameInput value={String(draft.title ?? "")} onChange={setTitle} />
            <WorkoutNotesCard value={String(draft.note ?? "")} onChange={setNote} />
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
                onToggleFavourite={(exerciseKey: string) => toggleFavourite(exerciseKey)}
                onToggleDropset={(exerciseKey: string) => toggleDropset(exerciseKey)}
                onOpenSuperset={(exerciseKey: string) => openSuperset(exerciseKey)}
                onOpenNote={(exerciseKey: string) => openExerciseNote(exerciseKey)}
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

      {/* ---- Modals ---- */}

      <AddExercisesSheet
        visible={addOpen}
        userId={String(userId ?? "")}
        selectedIds={selectedExerciseIds}
        onClose={() => setAddOpen(false)}
        onDone={(pickedItems: Array<{ exerciseId: string; name: string }>) => {
          addExercises(pickedItems);
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

      {/* ✅ Superset GROUP picker (then we open partner picker) */}
      <SupersetSheet
        visible={supersetOpen}
        exerciseName={String(anchorRow?.name ?? "Exercise")}
        currentGroup={(anchorRow?.supersetGroup as any) ?? null}
        existingGroups={existingGroups}
        suggestedNewGroup={suggestedNewGroup}
        onClose={() => {
          setSupersetOpen(false);
          setPendingAnchorKey(null);
          setPendingSupersetGroup(null);
          setRequirePartner(false);
        }}
        onPickGroup={(group: string | null) => {
          if (!pendingAnchorKey) return;

          // Clear superset
          if (!group) {
            setSupersetGroup(pendingAnchorKey, null);
            setSupersetOpen(false);
            setPendingAnchorKey(null);
            setPendingSupersetGroup(null);
            setRequirePartner(false);
            return;
          }

          const g = String(group).toUpperCase();

          // Is this a brand-new group for this workout (excluding anchor)?
          const othersInGroup = (draft.exercises ?? []).some(
            (x: any) =>
              String(x.key) !== String(pendingAnchorKey) &&
              String(x.supersetGroup ?? "").toUpperCase() === g
          );

          // If new group, require at least 1 partner (so "superset" means something)
          setRequirePartner(!othersInGroup);

          setPendingSupersetGroup(g);

          // Close group picker and open partner picker
          setSupersetOpen(false);
          setPickSupersetOpen(true);
        }}
      />

      {/* ✅ Superset PARTNER picker (ONLY current workout exercises) */}
      <SupersetPickExercisesSheet
        visible={pickSupersetOpen}
        anchorKey={String(pendingAnchorKey ?? "")}
        anchorName={String(anchorRow?.name ?? "Exercise")}
        group={String(pendingSupersetGroup ?? suggestedNewGroup)}
        items={pickItems}
        requireAtLeastOne={requirePartner}
        onClose={() => {
          setPickSupersetOpen(false);
          setPendingSupersetGroup(null);
          setRequirePartner(false);
          setPendingAnchorKey(null);
        }}
        onApply={(pickedKeys: string[]) => {
          if (!pendingAnchorKey) return;

          const g = String(pendingSupersetGroup ?? suggestedNewGroup).toUpperCase();

          // set group for anchor
          setSupersetGroup(pendingAnchorKey, g);

          // set group for chosen partners
          pickedKeys.forEach((k) => setSupersetGroup(String(k), g));

          // close + reset
          setPickSupersetOpen(false);
          setPendingSupersetGroup(null);
          setPendingAnchorKey(null);
          setRequirePartner(false);
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
