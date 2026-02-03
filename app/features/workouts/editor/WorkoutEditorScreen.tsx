// app/features/workouts/editor/WorkoutEditorScreen.tsx
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Alert, ScrollView, Pressable } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { Screen, ScreenHeader, Card, Button, Icon } from "@/ui";

import type { WorkoutDraft } from "../create/state/types";
import { snapshotHash } from "../create/state/helpers";

import CreateWorkoutHeader from "../create/ui/CreateWorkoutHeader";
import WorkoutNameInput from "../create/ui/WorkoutNameInput";
import WorkoutNotesCard from "../create/ui/WorkoutNotesCard";
import ExerciseList from "../create/ui/ExerciseList";
import EmptyExercisesState from "../create/ui/EmptyExercisesState";

import {
  AddExercisesSheet,
  ExerciseNoteSheet,
  DiscardChangesSheet,
  SupersetSheet,
  SupersetPickExercisesSheet,
} from "../create/modals";

type Mode = "create" | "edit";
export type SaveMode = "save" | "save_start";

// ✅ editor expects workoutId back so caller can route
export type SaveResult = { workoutId: string };

type WorkoutExerciseLite = {
  key: string;
  name: string;
  supersetGroup: string | null;
};

type Props = {
  mode: Mode;
  userId: string;

  draft: WorkoutDraft;

  setTitle: (title: string) => void;
  setNote: (note: string) => void;
  addExercises: (items: Array<{ exerciseId: string; name: string }>) => void;

  removeExercise: (exerciseKey: string) => void;
  toggleFavourite: (exerciseKey: string) => void;
  setExerciseNote: (exerciseKey: string, note: string) => void;

  toggleDropset: (exerciseKey: string) => void;
  setSupersetGroup: (exerciseKey: string, group: string | null) => void;

  markSavedNow: () => void;

  // ✅ FIXED SIGNATURE
  onSave: (draft: WorkoutDraft, mode: SaveMode) => Promise<SaveResult>;

  onDelete?: () => Promise<void>;

  allowSaveAndStart?: boolean;

  // ✅ editor should not assume router; parent decides navigation
  onAfterSave?: (result: SaveResult, mode: SaveMode) => void;
};

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

export default function WorkoutEditorScreen({
  mode,
  userId,

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

  onSave,
  onDelete,

  allowSaveAndStart = true,
  onAfterSave,
}: Props) {
  const { colors, layout } = useAppTheme();

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

  const isDirty = useMemo(() => {
    const current = snapshotHash(draft);
    const saved = draft.lastSavedSnapshotHash;
    return saved ? current !== saved : true;
  }, [draft]);

  const canSave = useMemo(() => {
    const hasTitle = String(draft.title ?? "").trim().length > 0;
    const hasExercises = (draft.exercises ?? []).length > 0;
    return hasTitle && hasExercises && !saving;
  }, [draft.title, draft.exercises, saving]);

  const selectedExerciseIds = useMemo(
    () => (draft.exercises ?? []).map((x: any) => String(x.exerciseId)),
    [draft.exercises]
  );

  const findByKey = useCallback(
    (exerciseKey: string) =>
      (draft.exercises ?? []).find((x: any) => String(x.key) === String(exerciseKey)) ?? null,
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

  const existingGroups = useMemo(
    () => getExistingGroups(draft.exercises ?? []),
    [draft.exercises]
  );

  const suggestedNewGroup = useMemo(
    () => nextGroupLetter(existingGroups),
    [existingGroups]
  );

  const pickItems: WorkoutExerciseLite[] = useMemo(() => {
    return (draft.exercises ?? []).map((x: any) => ({
      key: String(x.key),
      name: String(x.name ?? ""),
      supersetGroup: x.supersetGroup ? String(x.supersetGroup).toUpperCase() : null,
    }));
  }, [draft.exercises]);

  const openExerciseNote = useCallback((exerciseKey: string) => {
    setNoteExerciseKey(exerciseKey);
    setNoteOpen(true);
  }, []);

  const openSuperset = useCallback((exerciseKey: string) => {
    setPendingAnchorKey(exerciseKey);
    setPendingSupersetGroup(null);
    setRequirePartner(false);
    setSupersetOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!onDelete) return;
    Alert.alert("Delete workout?", "This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete() },
    ]);
  }, [onDelete]);

  const rightDelete = useMemo(() => {
    if (!onDelete) return null;
    return (
      <Pressable onPress={confirmDelete} hitSlop={10}>
        <Icon name="trash" size={20} color={colors.textMuted} />
      </Pressable>
    );
  }, [onDelete, confirmDelete, colors.textMuted]);

  // ✅ single save handler
  const doSave = useCallback(
    async (mode: SaveMode) => {
      if (!canSave) return;

      setSaving(true);
      try {
        const result = await onSave(draft, mode);
        markSavedNow();
        onAfterSave?.(result, mode);
      } catch (e: any) {
        console.warn("workout editor save error:", e);
        Alert.alert("Couldn’t save", e?.message ?? "Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [canSave, draft, onSave, markSavedNow, onAfterSave]
  );

  return (
    <Screen>
      <ScreenHeader
        title={mode === "edit" ? "Edit workout" : "Create workout"}
        showBack={true}
        right={rightDelete}
      />

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
        <Card>
          <View style={{ gap: layout.space.md }}>
            <CreateWorkoutHeader />
            <WorkoutNameInput value={String(draft.title ?? "")} onChange={setTitle} />
            <WorkoutNotesCard value={String(draft.note ?? "")} onChange={setNote} />
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
              <Text style={{ color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", fontSize: 12 }}>
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
                onRemove={(k: string) => removeExercise(k)}
                onToggleFavourite={(k: string) => toggleFavourite(k)}
                onToggleDropset={(k: string) => toggleDropset(k)}
                onOpenSuperset={(k: string) => openSuperset(k)}
                onOpenNote={(k: string) => openExerciseNote(k)}
              />
            ) : (
              <EmptyExercisesState onAdd={() => setAddOpen(true)} />
            )}
          </View>
        </Card>

        <View style={{ gap: layout.space.sm }}>
          {allowSaveAndStart ? (
            <Button
              title={saving ? "Saving..." : "Save & start"}
              onPress={() => doSave("save_start")}
              disabled={!canSave}
            />
          ) : null}

          <Button
            title={saving ? "Saving..." : mode === "edit" ? "Save changes" : "Save workout"}
            onPress={() => doSave("save")}
            disabled={!canSave}
            variant="secondary"
          />
        </View>
      </ScrollView>

      {/* Modals */}
      <AddExercisesSheet
        visible={addOpen}
        userId={userId}
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

          if (!group) {
            setSupersetGroup(pendingAnchorKey, null);
            setSupersetOpen(false);
            setPendingAnchorKey(null);
            setPendingSupersetGroup(null);
            setRequirePartner(false);
            return;
          }

          const g = String(group).toUpperCase();

          const othersInGroup = (draft.exercises ?? []).some(
            (x: any) =>
              String(x.key) !== String(pendingAnchorKey) &&
              String(x.supersetGroup ?? "").toUpperCase() === g
          );

          setRequirePartner(!othersInGroup);
          setPendingSupersetGroup(g);

          setSupersetOpen(false);
          setPickSupersetOpen(true);
        }}
      />

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

          setSupersetGroup(pendingAnchorKey, g);
          pickedKeys.forEach((k) => setSupersetGroup(String(k), g));

          setPickSupersetOpen(false);
          setPendingSupersetGroup(null);
          setPendingAnchorKey(null);
          setRequirePartner(false);
        }}
      />

      <DiscardChangesSheet
        visible={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscard={() => setDiscardOpen(false)}
      />
    </Screen>
  );
}
