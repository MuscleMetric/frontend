// app/features/plans/edit/workout.tsx
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";

import { useAppTheme } from "../../../../lib/useAppTheme";
import { useEditPlan, type WorkoutDraft, type WorkoutExerciseDraft } from "./store";

import { ScreenHeader, Card, Icon, Button } from "@/ui";
import AddExercisesSheet from "@/app/features/workouts/create/modals/AddExercisesSheet";

function safeInt(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function safeNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function nextGroupLetter(existing: string[]) {
  const used = new Set(existing.map((g) => String(g).toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode("A".charCodeAt(0) + i);
    if (!used.has(c)) return c;
  }
  return "A";
}

function normalizeDraft(d: WorkoutDraft) {
  return {
    title: (d.title ?? "").trim(),
    imageKey: d.imageKey ?? "",
    exercises: (d.exercises ?? []).map((e, idx) => ({
      order: idx,
      exerciseId: String(e.exercise?.id ?? ""),
      supersetGroup: e.supersetGroup ?? null,
      isDropset: !!e.isDropset,
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
  const { index } = useLocalSearchParams<{ index?: string }>();

  const workoutIndex = Number(index ?? "NaN");

  const { colors, layout, typography } = useAppTheme() as any;

  const { workouts, setWorkout } = useEditPlan();

  const initial = useMemo(() => {
    if (!Number.isFinite(workoutIndex)) return null;
    return workouts?.[workoutIndex] ?? null;
  }, [workoutIndex, workouts]);

  const [draft, setDraft] = useState<WorkoutDraft>(() => {
    // If index is bad, fallback to a blank draft (won't save)
    return (
      initial ?? {
        title: "Workout",
        exercises: [],
        imageKey: "",
      }
    );
  });

  // Keep local draft in sync if store updates after mount (rare, but safe)
  React.useEffect(() => {
    if (initial) setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const initialSnap = useMemo(() => {
    return initial ? JSON.stringify(normalizeDraft(initial)) : null;
  }, [initial]);

  const isDirty = useMemo(() => {
    if (!initialSnap) return false;
    return initialSnap !== JSON.stringify(normalizeDraft(draft));
  }, [initialSnap, draft]);

  const [addOpen, setAddOpen] = useState(false);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);

  const exercises = draft.exercises ?? [];

  const selectedIds = useMemo(
    () => exercises.map((x) => String(x.exercise.id)),
    [exercises]
  );

  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((x) => {
      if (x.supersetGroup) set.add(String(x.supersetGroup).toUpperCase());
    });
    return Array.from(set).sort();
  }, [exercises]);

  const suggestedGroup = useMemo(
    () => nextGroupLetter(existingGroups),
    [existingGroups]
  );

  const setExercises = useCallback(
    (next: WorkoutExerciseDraft[]) => {
      const reindexed = next.map((e, i) => ({ ...e, order_index: i }));
      setDraft((cur) => ({ ...cur, exercises: reindexed }));
    },
    []
  );

  const updateExercise = useCallback(
    (exerciseId: string, patch: Partial<WorkoutExerciseDraft>) => {
      const next = exercises.map((ex) =>
        String(ex.exercise.id) === String(exerciseId) ? { ...ex, ...patch } : ex
      );
      setExercises(next);
    },
    [exercises, setExercises]
  );

  const removeExercise = useCallback(
    (exerciseId: string) => {
      const next = exercises.filter(
        (ex) => String(ex.exercise.id) !== String(exerciseId)
      );
      setExercises(next);
      if (openExerciseId === exerciseId) setOpenExerciseId(null);
    },
    [exercises, setExercises, openExerciseId]
  );

  const toggleDropset = useCallback(
    (exerciseId: string) => {
      const row = exercises.find(
        (x) => String(x.exercise.id) === String(exerciseId)
      );
      if (!row) return;
      updateExercise(exerciseId, { isDropset: !row.isDropset });
    },
    [exercises, updateExercise]
  );

  const assignSuperset = useCallback(
    (exerciseId: string, group: string | null) => {
      updateExercise(exerciseId, {
        supersetGroup: group ? String(group).toUpperCase() : null,
      });
    },
    [updateExercise]
  );

  const handleAddExercises = useCallback(
    (picked: Array<{ exerciseId: string; name: string }>) => {
      if (!picked.length) return;

      const existing = new Set(exercises.map((e) => String(e.exercise.id)));

      const newRows: WorkoutExerciseDraft[] = picked
        .filter((p) => !existing.has(String(p.exerciseId)))
        .map((p) => ({
          exercise: {
            id: String(p.exerciseId),
            name: p.name,
            type: "strength",
          },
          order_index: 0,
          supersetGroup: null,
          isDropset: false,
          target_sets: null,
          target_reps: null,
          target_weight: null,
          target_time_seconds: null,
          target_distance: null,
          notes: null,
        }));

      const merged = [...exercises, ...newRows];
      setExercises(merged);
    },
    [exercises, setExercises]
  );

  const onCancel = useCallback(() => {
    if (!isDirty) return router.back();

    Alert.alert("Discard changes?", "You have unsaved edits.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
  }, [isDirty, router]);

  const onSave = useCallback(() => {
    if (!Number.isFinite(workoutIndex) || !workouts?.[workoutIndex]) {
      Alert.alert("Can't save", "Workout index is invalid.");
      return;
    }

    const trimmedTitle = (draft.title ?? "").trim();
    if (!trimmedTitle) {
      Alert.alert("Add a workout title");
      return;
    }

    // ✅ Save to Zustand, then back
    setWorkout(workoutIndex, {
      ...draft,
      title: trimmedTitle,
      exercises: (draft.exercises ?? []).map((e, i) => ({ ...e, order_index: i })),
    });

    router.back();
  }, [draft, router, setWorkout, workoutIndex, workouts]);

  if (!Number.isFinite(workoutIndex) || !initial) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Workout" />
        <View style={{ padding: layout.space.lg }}>
          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium }}>
            This workout can’t be found.
          </Text>
          <View style={{ marginTop: layout.space.md }}>
            <Button title="Go back" onPress={() => router.back()} variant="secondary" />
          </View>
        </View>
      </View>
    );
  }

  const footerH = 88;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={draft.title?.trim() ? "Edit Workout" : "Workout"}
        right={
          <View style={{ width: 44, alignItems: "flex-end" }}>
            {isDirty ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.primaryBg ?? colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.primaryText ?? colors.primary,
                    fontWeight: "900",
                    fontSize: 11,
                    letterSpacing: 0.3,
                  }}
                >
                  Edited
                </Text>
              </View>
            ) : (
              <Icon name="checkmark-circle" size={18} color={colors.success} />
            )}
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.md,
          paddingBottom: footerH + layout.space.xl,
          gap: layout.space.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Workout name */}
        <Card>
          <View style={{ gap: 10 }}>
            <Text
              style={{
                color: colors.textMuted,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                fontSize: 12,
                fontFamily: typography.fontFamily.semibold,
              }}
            >
              Workout name
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: layout.radius.xl,
                paddingHorizontal: layout.space.md,
                paddingVertical: 12,
              }}
            >
              <Icon name="create-outline" size={18} color={colors.textMuted} />
              <TextInput
                value={draft.title}
                onChangeText={(t) => setDraft((cur) => ({ ...cur, title: t }))}
                placeholder="Workout title"
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontFamily: typography.fontFamily.semibold,
                  fontSize: 16,
                }}
              />
            </View>

            <Pressable
              onPress={() => setAddOpen(true)}
              style={{
                height: 46,
                borderRadius: layout.radius.xl,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.onPrimary, fontFamily: typography.fontFamily.bold }}>
                Add exercises
              </Text>
            </Pressable>
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
                  fontFamily: typography.fontFamily.semibold,
                }}
              >
                Exercises
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {exercises.length}
              </Text>
            </View>

            {exercises.length === 0 ? (
              <View
                style={{
                  padding: layout.space.md,
                  borderRadius: layout.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  gap: 6,
                }}
              >
                <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold }}>
                  No exercises yet
                </Text>
                <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium }}>
                  Add exercises to start building this workout.
                </Text>

                <View style={{ marginTop: 10 }}>
                  <Button title="Add exercises" onPress={() => setAddOpen(true)} />
                </View>
              </View>
            ) : (
              <DraggableFlatList<WorkoutExerciseDraft>
                data={exercises}
                keyExtractor={(item) => String(item.exercise.id)}
                activationDistance={6}
                scrollEnabled={false}
                onDragEnd={({ data }) => setExercises(data)}
                renderItem={({ item, drag, isActive }: RenderItemParams<WorkoutExerciseDraft>) => (
                  <ExerciseRow
                    item={item}
                    drag={drag}
                    isActive={isActive}
                    isOpen={openExerciseId === item.exercise.id}
                    onToggleOpen={() =>
                      setOpenExerciseId((cur) =>
                        cur === item.exercise.id ? null : item.exercise.id
                      )
                    }
                    onRemove={() => removeExercise(item.exercise.id)}
                    onToggleDropset={() => toggleDropset(item.exercise.id)}
                    onSetSuperset={(group) => assignSuperset(item.exercise.id, group)}
                    suggestedGroup={suggestedGroup}
                    existingGroups={existingGroups}
                    onUpdate={(patch) => updateExercise(item.exercise.id, patch)}
                  />
                )}
              />
            )}
          </View>
        </Card>
      </ScrollView>

      {/* Footer */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: layout.space.lg,
          paddingTop: 12,
          paddingBottom: 14,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={onCancel}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={onSave}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
              borderWidth: 1,
              borderColor: colors.primary,
              opacity: isDirty ? 1 : 0.55,
            }}
            disabled={!isDirty}
          >
            <Text style={{ color: colors.onPrimary ?? "#fff", fontWeight: "900" }}>
              Save
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Add Exercises */}
      <AddExercisesSheet
        visible={addOpen}
        userId={"me"} // ✅ your sheet requires userId; if it actually needs real userId, pass it from auth.
        selectedIds={selectedIds}
        onClose={() => setAddOpen(false)}
        onDone={(picked) => handleAddExercises(picked)}
        enableMuscleFilter
        enableEquipmentFilter
      />
    </View>
  );
}

/* ---------------- row ---------------- */

function ExerciseRow({
  item,
  drag,
  isActive,
  isOpen,
  onToggleOpen,
  onRemove,
  onToggleDropset,
  onSetSuperset,
  suggestedGroup,
  existingGroups,
  onUpdate,
}: {
  item: WorkoutExerciseDraft;
  drag: () => void;
  isActive: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onRemove: () => void;
  onToggleDropset: () => void;
  onSetSuperset: (group: string | null) => void;
  suggestedGroup: string;
  existingGroups: string[];
  onUpdate: (patch: Partial<WorkoutExerciseDraft>) => void;
}) {
  const { colors, layout, typography } = useAppTheme() as any;

  const dropsOn = !!item.isDropset;
  const superset = item.supersetGroup ? String(item.supersetGroup).toUpperCase() : null;

  return (
    <View
      style={{
        marginTop: 10,
        borderRadius: layout.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: isActive ? 0.85 : 1,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onToggleOpen}
        style={{
          paddingHorizontal: layout.space.md,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Pressable onLongPress={drag} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="reorder-three-outline" size={20} color={colors.textMuted} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.semibold,
            }}
            numberOfLines={1}
          >
            {item.exercise.name}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            {superset ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.primary,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "900" }}>
                  Superset {superset}
                </Text>
              </View>
            ) : null}

            {dropsOn ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: colors.warning,
                }}
              >
                <Text style={{ color: "#0B1220", fontSize: 11, fontWeight: "900" }}>
                  Dropset
                </Text>
              </View>
            ) : null}

            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700" }}>
              Tap to {isOpen ? "collapse" : "edit"}
            </Text>
          </View>
        </View>

        <Pressable onPress={onRemove} hitSlop={10}>
          <Icon name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </Pressable>

      {isOpen ? (
        <View
          style={{
            padding: layout.space.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 12,
          }}
        >
          {/* Quick actions */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Pressable
              onPress={onToggleDropset}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: dropsOn ? colors.warning : colors.bg,
              }}
            >
              <Text style={{ color: dropsOn ? "#0B1220" : colors.text, fontWeight: "900", fontSize: 12 }}>
                {dropsOn ? "Dropset on" : "Dropset"}
              </Text>
            </Pressable>

            {!superset ? (
              <Pressable
                onPress={() => onSetSuperset(suggestedGroup)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
                  Start superset ({suggestedGroup})
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => onSetSuperset(null)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: "900", fontSize: 12 }}>
                  Remove superset
                </Text>
              </Pressable>
            )}

            {!superset && existingGroups.length
              ? existingGroups.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => onSetSuperset(g)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.bg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
                      Add to {g}
                    </Text>
                  </Pressable>
                ))
              : null}
          </View>

          {/* Targets */}
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <TargetField
              label="Sets"
              value={item.target_sets}
              placeholder="e.g. 3"
              onChange={(t) => onUpdate({ target_sets: safeInt(t) })}
            />
            <TargetField
              label="Reps"
              value={item.target_reps}
              placeholder="e.g. 8"
              onChange={(t) => onUpdate({ target_reps: safeInt(t) })}
            />
            <TargetField
              label="Weight"
              value={item.target_weight}
              placeholder="kg"
              onChange={(t) => onUpdate({ target_weight: safeNum(t) })}
            />
          </View>

          {/* Notes */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Exercise notes
            </Text>
            <TextInput
              value={item.notes ?? ""}
              onChangeText={(t) => onUpdate({ notes: t })}
              placeholder="Cueing, tempo, RPE..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                minHeight: 70,
                textAlignVertical: "top",
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: layout.radius.lg,
                paddingHorizontal: layout.space.md,
                paddingVertical: 10,
                color: colors.text,
                fontFamily: typography.fontFamily.medium,
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TargetField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  placeholder: string;
  onChange: (t: string) => void;
}) {
  const { colors, layout, typography } = useAppTheme() as any;

  return (
    <View style={{ flex: 1, minWidth: 92, gap: 6 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: typography.fontFamily.semibold }}>
        {label}
      </Text>
      <TextInput
        value={typeof value === "number" ? String(value) : ""}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
        style={{
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: layout.radius.lg,
          paddingHorizontal: layout.space.md,
          paddingVertical: 10,
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
        }}
      />
    </View>
  );
}
