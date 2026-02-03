// app/features/plans/editor/workoutEditor.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";

import { useAppTheme } from "@/lib/useAppTheme";
import { Screen, ScreenHeader, Card, Button, Icon } from "@/ui";

// ✅ Use the newer working selector
import AddExercisesSheet from "@/app/features/workouts/create/modals/AddExercisesSheet";

// ✅ Plan draft types
import type { WorkoutDraft, WorkoutExercise } from "../create/store";

type Props = {
  userId: string;

  // context (for header + step indicator)
  workoutIndex: number; // 0-based
  workoutsPerWeek: number;

  draft: WorkoutDraft;

  // parent owns storage (zustand or local state)
  onChange: (next: WorkoutDraft) => void;

  // navigation decided by parent
  onBack: () => void;
  onNext: () => void;

  // optional: label overrides
  title?: string; // header title
};

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

export default function PlanWorkoutEditor({
  userId,
  workoutIndex,
  workoutsPerWeek,
  draft,
  onChange,
  onBack,
  onNext,
  title = "Build your week",
}: Props) {
  const { colors, layout, typography } = useAppTheme();

  const [addOpen, setAddOpen] = useState(false);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);

  const exercises = draft.exercises ?? [];

  const selectedIds = useMemo(
    () => exercises.map((x) => String(x.exercise.id)),
    [exercises]
  );

  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    (exercises ?? []).forEach((x) => {
      if (x.supersetGroup) set.add(String(x.supersetGroup).toUpperCase());
    });
    return Array.from(set).sort();
  }, [exercises]);

  const suggestedGroup = useMemo(
    () => nextGroupLetter(existingGroups),
    [existingGroups]
  );

  const setDraft = useCallback(
    (patch: Partial<WorkoutDraft>) => {
      onChange({ ...draft, ...patch });
    },
    [draft, onChange]
  );

  const setExercises = useCallback(
    (next: WorkoutExercise[]) => {
      const reindexed = next.map((e, i) => ({ ...e, order_index: i }));
      setDraft({ exercises: reindexed });
    },
    [setDraft]
  );

  const updateExercise = useCallback(
    (exerciseId: string, patch: Partial<WorkoutExercise>) => {
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

      const newRows: WorkoutExercise[] = picked
        .filter((p) => !existing.has(String(p.exerciseId)))
        .map((p) => ({
          exercise: {
            id: String(p.exerciseId),
            name: p.name,
            type: "strength", // safe default; you can improve later if you want
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

  const canContinue = useMemo(() => {
    const hasTitle = String(draft.title ?? "").trim().length > 0;
    const hasExercises = (draft.exercises ?? []).length > 0;
    return hasTitle && hasExercises;
  }, [draft.title, draft.exercises]);

  const doNext = useCallback(() => {
    if (!String(draft.title ?? "").trim()) {
      Alert.alert("Add a workout title");
      return;
    }
    if (!(draft.exercises ?? []).length) {
      Alert.alert("Add at least one exercise");
      return;
    }
    onNext();
  }, [draft, onNext]);

  return (
    <Screen>
      <ScreenHeader
        title={title}
        showBack={true}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontFamily: typography.fontFamily.semibold,
              }}
            >
              Step 2 of 4
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontFamily: typography.fontFamily.semibold,
              }}
            >
              {Math.round(
                ((workoutIndex + 1) / Math.max(1, workoutsPerWeek)) * 100
              )}
              %
            </Text>
          </View>
        }
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
        {/* Intro */}
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 28,
              letterSpacing: -0.4,
            }}
          >
            Build this workout
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fontFamily.medium,
            }}
          >
            Workout {workoutIndex + 1} of {workoutsPerWeek}
          </Text>
        </View>

        {/* Title + actions */}
        <Card>
          <View style={{ gap: layout.space.md }}>
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  color: colors.textMuted,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                Workout name
              </Text>

              <TextInput
                value={draft.title}
                onChangeText={(t) => setDraft({ title: t })}
                placeholder={`Workout ${workoutIndex + 1}`}
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: layout.radius.xl,
                  paddingHorizontal: layout.space.md,
                  paddingVertical: 14,
                  color: colors.text,
                  fontFamily: typography.fontFamily.semibold,
                  fontSize: 16,
                }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: layout.space.sm }}>
              <Pressable
                onPress={() => setAddOpen(true)}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: layout.radius.xl,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.onPrimary,
                    fontFamily: typography.fontFamily.bold,
                  }}
                >
                  + Add exercises
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setAddOpen(true)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="search" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </Card>

        {/* Notes */}
        <Card>
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: colors.textMuted,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                fontSize: 12,
              }}
            >
              Notes
            </Text>
            <TextInput
              value={draft.notes ?? ""}
              onChangeText={(t) => setDraft({ notes: t })}
              placeholder="Optional coaching notes, tempo, warm-up..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                minHeight: 90,
                textAlignVertical: "top",
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: layout.radius.xl,
                paddingHorizontal: layout.space.md,
                paddingVertical: 12,
                color: colors.text,
                fontFamily: typography.fontFamily.medium,
              }}
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

            {(draft.exercises ?? []).length === 0 ? (
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
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fontFamily.bold,
                  }}
                >
                  No exercises yet
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontFamily: typography.fontFamily.medium,
                  }}
                >
                  Add exercises to start building this workout.
                </Text>

                <View style={{ marginTop: 10 }}>
                  <Button
                    title="+ Add exercises"
                    onPress={() => setAddOpen(true)}
                  />
                </View>
              </View>
            ) : (
              <DraggableFlatList<WorkoutExercise>
                data={exercises}
                keyExtractor={(item) => String(item.exercise.id)}
                activationDistance={6}
                scrollEnabled={false}
                onDragEnd={({ data }) => setExercises(data)}
                renderItem={({
                  item,
                  drag,
                  isActive,
                }: RenderItemParams<WorkoutExercise>) => (
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
                    onSetSuperset={(group) =>
                      assignSuperset(item.exercise.id, group)
                    }
                    suggestedGroup={suggestedGroup}
                    existingGroups={existingGroups}
                    onUpdate={(patch) =>
                      updateExercise(item.exercise.id, patch)
                    }
                  />
                )}
              />
            )}
          </View>
        </Card>

        {/* Continue */}
        <View style={{ gap: layout.space.sm }}>
          <Button title="Continue" onPress={doNext} disabled={!canContinue} />
          <Button title="Back" onPress={onBack} variant="secondary" />
        </View>
      </ScrollView>

      {/* ✅ New selector */}
      <AddExercisesSheet
        visible={addOpen}
        userId={userId}
        selectedIds={selectedIds}
        onClose={() => setAddOpen(false)}
        onDone={(picked) => handleAddExercises(picked)}
        enableMuscleFilter
        enableEquipmentFilter
      />
    </Screen>
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
  item: WorkoutExercise;
  drag: () => void;
  isActive: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onRemove: () => void;
  onToggleDropset: () => void;
  onSetSuperset: (group: string | null) => void;
  suggestedGroup: string;
  existingGroups: string[];
  onUpdate: (patch: Partial<WorkoutExercise>) => void;
}) {
  const { colors, layout, typography } = useAppTheme();

  const dropsOn = !!item.isDropset;
  const superset = item.supersetGroup
    ? String(item.supersetGroup).toUpperCase()
    : null;

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
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fontFamily.bold,
            }}
          >
            ≡
          </Text>
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

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
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
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 11,
                    fontFamily: typography.fontFamily.bold,
                  }}
                >
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
                <Text
                  style={{
                    color: "#0B1220",
                    fontSize: 11,
                    fontFamily: typography.fontFamily.bold,
                  }}
                >
                  Dropset
                </Text>
              </View>
            ) : null}

            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontFamily: typography.fontFamily.medium,
              }}
            >
              Tap to {isOpen ? "collapse" : "edit"}
            </Text>
          </View>
        </View>

        <Pressable onPress={onRemove} hitSlop={10}>
          <Text
            style={{
              color: colors.danger,
              fontFamily: typography.fontFamily.bold,
              fontSize: 12,
            }}
          >
            Remove
          </Text>
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
              <Text
                style={{
                  color: dropsOn ? "#0B1220" : colors.text,
                  fontFamily: typography.fontFamily.bold,
                  fontSize: 12,
                }}
              >
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
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fontFamily.bold,
                    fontSize: 12,
                  }}
                >
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
                <Text
                  style={{
                    color: colors.textMuted,
                    fontFamily: typography.fontFamily.bold,
                    fontSize: 12,
                  }}
                >
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
                    <Text
                      style={{
                        color: colors.text,
                        fontFamily: typography.fontFamily.bold,
                        fontSize: 12,
                      }}
                    >
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
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
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
  const { colors, layout, typography } = useAppTheme();

  return (
    <View style={{ flex: 1, minWidth: 92, gap: 6 }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          fontFamily: typography.fontFamily.semibold,
        }}
      >
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
