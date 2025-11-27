// app/features/workouts/create/auto-review.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/useAuth";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type {
  GeneratedWorkout,
  GeneratedWorkoutExercise,
} from "./workoutGenerator";

type ExerciseOption = {
  id: string;
  name: string;
  type: string | null;
  equipment: string | null;
};

type WorkoutExercise = {
  key: string; // stable key for drag list
  exerciseId: string;
  name: string;
  note?: string | null;
};

/* ---------- muscle + equipment filters ---------- */

const MUSCLE_GROUPS = [
  {
    id: "chest",
    label: "Chest",
    muscleIds: [1],
  },
  {
    id: "back",
    label: "Back",
    muscleIds: [2, 88, 89, 90, 99, 98],
  },
  {
    id: "shoulders",
    label: "Shoulders",
    muscleIds: [8],
  },
  {
    id: "biceps",
    label: "Biceps",
    muscleIds: [6, 91],
  },
  {
    id: "triceps",
    label: "Triceps",
    muscleIds: [7],
  },
  {
    id: "core",
    label: "Abs / Core",
    muscleIds: [96, 97, 10, 100, 101],
  },
  {
    id: "quads",
    label: "Quads",
    muscleIds: [3, 92],
  },
  {
    id: "hamstrings",
    label: "Hamstrings",
    muscleIds: [4],
  },
  {
    id: "glutes_hips",
    label: "Glutes & Hips",
    muscleIds: [5, 94, 93, 95],
  },
  {
    id: "calves",
    label: "Calves",
    muscleIds: [9],
  },
] as const;

const EQUIPMENT_OPTIONS: string[] = [
  "ab wheel",
  "air bike",
  "backpack",
  "band",
  "barbell",
  "battle rope",
  "battle ropes",
  "bench",
  "bike",
  "bike erg",
  "bodyweight",
  "cable",
  "captain's chair",
  "decline bench",
  "dumbbell",
  "dumbbells",
  "elliptical",
  "ez-bar",
  "foam roller",
  "heavy bag",
  "jacobs ladder",
  "kettlebell",
  "ladder",
  "landmine",
  "machine",
  "med ball",
  "medicine ball",
  "parallel bars",
  "parallettes",
  "plate",
  "plates",
  "plyo box",
  "pool",
  "pull-up bar",
  "rope",
  "rowing machine",
  "ski erg",
  "sled",
  "slider",
  "smith machine",
  "stability ball",
  "stair climber",
  "trap bar",
  "treadmill",
  "wrist roller",
];

export default function AutoReviewWorkoutScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ workout?: string }>();

  const parsedWorkout: GeneratedWorkout | null = useMemo(() => {
    if (!params.workout || typeof params.workout !== "string") return null;
    try {
      return JSON.parse(params.workout) as GeneratedWorkout;
    } catch (e) {
      console.warn("Failed to parse generated workout param", e);
      return null;
    }
  }, [params.workout]);

  const [title, setTitle] = useState<string>(
    parsedWorkout?.title ?? "Generated Workout"
  );
  const [notes, setNotes] = useState<string>(parsedWorkout?.notes ?? "");

  const [saving, setSaving] = useState(false);

  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>(
    []
  );

  // modal state
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exLoading, setExLoading] = useState(false);
  const [modalSelectedIds, setModalSelectedIds] = useState<string[]>([]);

  // multi-select filters
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(
    []
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // collapsible filters
  const [muscleFilterOpen, setMuscleFilterOpen] = useState(false);
  const [equipmentFilterOpen, setEquipmentFilterOpen] = useState(false);

  const canSave =
    !!userId &&
    title.trim().length > 0 &&
    selectedExercises.length > 0 &&
    !saving;

  // Initialise from generated workout once
  useEffect(() => {
    if (!parsedWorkout) return;

    setTitle(parsedWorkout.title || "Generated Workout");
    setNotes(parsedWorkout.notes ?? "");

    const mapped: WorkoutExercise[] = (parsedWorkout.exercises ?? []).map(
      (ex: GeneratedWorkoutExercise, idx: number) => ({
        key: `${ex.exercise_id}-${ex.order_index ?? idx}`,
        exerciseId: ex.exercise_id,
        name: ex.name,
        note: ex.notes ?? null,
      })
    );

    setSelectedExercises(mapped);
  }, [parsedWorkout]);

  // muscle filter toggle
  const toggleMuscleGroup = (groupId: string) => {
    setSelectedMuscleGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  // equipment filter toggle
  const toggleEquipment = (eq: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  // load exercises for picker when modal is open or filters/search change
  useEffect(() => {
    let alive = true;

    if (!exerciseModalVisible) {
      return () => {
        alive = false;
      };
    }

    (async () => {
      setExLoading(true);

      try {
        const hasMuscleFilter = selectedMuscleGroups.length > 0;

        let q = supabase
          .from("exercises")
          .select(
            hasMuscleFilter
              ? `
              id,
              name,
              type,
              equipment,
              exercise_muscles!inner(
                muscle_id
              )
            `
              : `
              id,
              name,
              type,
              equipment
            `
          )
          .order("name", { ascending: true })
          .limit(600);

        if (exerciseSearch.trim()) {
          q = q.ilike("name", `%${exerciseSearch.trim()}%`);
        }

        if (selectedEquipment.length > 0) {
          q = q.in("equipment", selectedEquipment);
        }

        if (hasMuscleFilter) {
          const muscleIdSet = new Set<number>();
          selectedMuscleGroups.forEach((gid) => {
            const group = MUSCLE_GROUPS.find((g) => g.id === gid);
            group?.muscleIds.forEach((mid) => muscleIdSet.add(mid));
          });
          const muscleIds = Array.from(muscleIdSet);
          if (muscleIds.length > 0) {
            q = q.in("exercise_muscles.muscle_id", muscleIds);
          }
        }

        const { data, error } = await q;

        if (error) {
          console.warn("exercise picker load error", error);
          if (alive) setExerciseOptions([]);
          return;
        }

        if (alive) {
          setExerciseOptions(
            (data ?? []).map((row: any) => ({
              id: row.id,
              name: row.name,
              type: row.type ?? null,
              equipment: row.equipment ?? null,
            }))
          );
        }
      } finally {
        if (alive) setExLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    exerciseModalVisible,
    exerciseSearch,
    selectedMuscleGroups,
    selectedEquipment,
  ]);

  // modal selection handler
  const toggleModalSelect = (exerciseId: string) => {
    setModalSelectedIds((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };

  const handleConfirmAddExercises = () => {
    if (!modalSelectedIds.length) return;

    setSelectedExercises((prev) => {
      const existingIds = new Set(prev.map((e) => e.exerciseId));
      const now = Date.now();

      const newItems: WorkoutExercise[] = [];
      modalSelectedIds.forEach((id, idx) => {
        if (existingIds.has(id)) return;
        const ex = exerciseOptions.find((er) => er.id === id);
        if (!ex) return;

        newItems.push({
          key: `${id}-${now}-${idx}`,
          exerciseId: id,
          name: ex.name,
        });
      });

      return [...prev, ...newItems];
    });

    setModalSelectedIds([]);
    setExerciseModalVisible(false);
  };

  const handleRemoveExercise = (key: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.key !== key));
  };

  const handleSave = async () => {
    if (!canSave || !userId) return;
    try {
      setSaving(true);

      const { data: wData, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          title: title.trim(),
          notes: notes.trim() || null, // workout-level notes
        })
        .select("id")
        .single();

      if (wErr) throw wErr;

      const workoutId = wData.id as string;

      const inserts = selectedExercises.map((ex, idx) => ({
        workout_id: workoutId,
        exercise_id: ex.exerciseId,
        order_index: idx,
        // exercise-level notes would go here once the DB supports it
      }));

      if (inserts.length) {
        const { error: weErr } = await supabase
          .from("workout_exercises")
          .insert(inserts);
        if (weErr) throw weErr;
      }

      router.back();
    } catch (e) {
      console.warn("save generated workout error", e);
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <Text style={s.muted}>Sign in to save workouts.</Text>
      </SafeAreaView>
    );
  }

  if (!parsedWorkout) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <Text style={s.muted}>
          Something went wrong loading this generated workout.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[s.saveBtn, { marginTop: 12 }]}
        >
          <Text style={s.saveBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      >
        {/* Header */}
        <View style={s.rowBetween}>
          <Text style={s.h2}>Review Generated Workout</Text>
          <Text style={s.generatedTag}>Auto</Text>
        </View>
        <Text style={[s.muted, { marginTop: 4 }]}>
          This workout was generated based on your answers. You can tweak
          anything before saving.
        </Text>

        {/* Title */}
        <View style={s.card}>
          <Text style={s.label}>Workout Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Upper Body Push, Leg Day..."
            placeholderTextColor={colors.subtle}
            style={s.input}
          />
        </View>

        {/* Overall notes (from generator) */}
        <View style={s.card}>
          <Text style={s.label}>Workout Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="High-level guidance for this session…"
            placeholderTextColor={colors.subtle}
            style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
            multiline
          />
        </View>

        {/* Selected exercises with drag & drop */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.label}>Exercises</Text>
            <Pressable
              onPress={() => {
                setExerciseModalVisible(true);
              }}
              style={s.addExerciseBtn}
            >
              <Text style={s.addExerciseText}>+ Add Exercises</Text>
            </Pressable>
          </View>

          {selectedExercises.length === 0 ? (
            <Text style={[s.muted, { marginTop: 8 }]}>
              Add at least one exercise to save this workout.
            </Text>
          ) : (
            <DraggableFlatList<WorkoutExercise>
              data={selectedExercises}
              keyExtractor={(item) => item.key}
              scrollEnabled={false}
              onDragEnd={({ data }: { data: WorkoutExercise[] }) =>
                setSelectedExercises(data)
              }
              renderItem={({
                item,
                drag,
                isActive,
              }: RenderItemParams<WorkoutExercise>) => (
                <View
                  style={[
                    s.exerciseRow,
                    isActive && { backgroundColor: colors.surface },
                  ]}
                >
                  {/* BIG DRAG AREA: name + notes + handle */}
                  <Pressable
                    onLongPress={drag}
                    disabled={isActive}
                    style={{ flex: 1 }}
                  >
                    <Text style={s.exerciseName}>{item.name}</Text>
                    {!!item.note && (
                      <Text style={s.exerciseNote}>{item.note}</Text>
                    )}
                  </Pressable>

                  {/* SEPARATE REMOVE BUTTON – not part of drag area */}
                  <Pressable
                    onPress={() => handleRemoveExercise(item.key)}
                    hitSlop={10}
                  >
                    <Text style={s.remove}>Remove</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[s.saveBtn, !canSave && { opacity: 0.4 }]}
        >
          <Text style={s.saveBtnText}>
            {canSave ? "Save Workout" : "Add a title & at least one exercise"}
          </Text>
        </Pressable>
      </ScrollView>

      {/* FULL-SCREEN EXERCISE PICKER MODAL */}
      <Modal
        visible={exerciseModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setExerciseModalVisible(false)}
      >
        <SafeAreaView
          style={[
            s.modalSafeArea,
            {
              paddingTop: insets.top,
              backgroundColor: colors.background,
            },
          ]}
        >
          {/* Header row */}
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select exercises</Text>
            <Pressable
              onPress={() => setExerciseModalVisible(false)}
              hitSlop={10}
            >
              <Text style={[s.modalClose, { color: colors.primary }]}>
                Close
              </Text>
            </Pressable>
          </View>

          {/* Search */}
          <TextInput
            value={exerciseSearch}
            onChangeText={setExerciseSearch}
            placeholder="Search exercises…"
            placeholderTextColor={colors.subtle}
            style={[
              s.modalSearchInput,
              { color: colors.text, backgroundColor: colors.surface },
            ]}
          />

          {/* FILTER BAR */}
          <View style={{ marginTop: 8 }}>
            <View style={s.filterBar}>
              {/* Muscles pill */}
              <Pressable
                onPress={() => setMuscleFilterOpen((open) => !open)}
                style={[
                  s.filterPill,
                  muscleFilterOpen && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    s.filterPillLabel,
                    muscleFilterOpen && {
                      color: colors.subtle ?? "#fff",
                    },
                  ]}
                >
                  Muscles
                </Text>
                {selectedMuscleGroups.length > 0 && (
                  <Text
                    style={[
                      s.filterPillCount,
                      muscleFilterOpen && {
                        color: colors.subtle ?? "#fff",
                      },
                    ]}
                  >
                    {selectedMuscleGroups.length}
                  </Text>
                )}
              </Pressable>

              {/* Equipment pill */}
              <Pressable
                onPress={() => setEquipmentFilterOpen((open) => !open)}
                style={[
                  s.filterPill,
                  equipmentFilterOpen && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    s.filterPillLabel,
                    equipmentFilterOpen && {
                      color: colors.subtle ?? "#fff",
                    },
                  ]}
                >
                  Equipment
                </Text>
                {selectedEquipment.length > 0 && (
                  <Text
                    style={[
                      s.filterPillCount,
                      equipmentFilterOpen && {
                        color: colors.subtle ?? "#fff",
                      },
                    ]}
                  >
                    {selectedEquipment.length}
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Summary */}
            <Text style={s.filterSummaryText}>
              {selectedMuscleGroups.length
                ? `${selectedMuscleGroups.length} muscle group${
                    selectedMuscleGroups.length === 1 ? "" : "s"
                  }`
                : "No Muscles"}
              {" · "}
              {selectedEquipment.length
                ? `${selectedEquipment.length} equipment option${
                    selectedEquipment.length === 1 ? "" : "s"
                  }`
                : "No Equipment"}{" "}
              selected
            </Text>
          </View>

          {/* MUSCLE CHIPS */}
          {muscleFilterOpen && (
            <View style={s.chipSection}>
              <View style={s.chipGrid}>
                {MUSCLE_GROUPS.map((g) => {
                  const active = selectedMuscleGroups.includes(g.id);
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => toggleMuscleGroup(g.id)}
                      style={[
                        s.chip,
                        active && {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.chipLabel,
                          active && {
                            color: colors.subtle ?? "#fff",
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {g.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* EQUIPMENT CHIPS */}
          {equipmentFilterOpen && (
            <View style={s.chipSection}>
              <View style={s.chipGrid}>
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const active = selectedEquipment.includes(eq);
                  return (
                    <Pressable
                      key={eq}
                      onPress={() => toggleEquipment(eq)}
                      style={[
                        s.chip,
                        active && {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.chipLabel,
                          active && {
                            color: colors.subtle ?? "#fff",
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {eq}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* List */}
          {exLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <FlatList
              data={exerciseOptions}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item }) => {
                const isSelected = modalSelectedIds.includes(item.id);
                return (
                  <Pressable
                    onPress={() => toggleModalSelect(item.id)}
                    style={[
                      s.modalRow,
                      isSelected && {
                        borderColor: colors.primary,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.modalExerciseName,
                          isSelected && { color: colors.primary },
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={s.modalExerciseMeta}>
                        {item.type || ""}
                        {item.equipment ? ` • ${item.equipment}` : ""}
                      </Text>
                    </View>

                    <View
                      style={[
                        s.checkbox,
                        {
                          borderColor: isSelected
                            ? colors.primary
                            : colors.border,
                          backgroundColor: isSelected
                            ? colors.primary
                            : "transparent",
                        },
                      ]}
                    >
                      {isSelected && (
                        <Text
                          style={{
                            color: colors.subtle,
                            fontSize: 10,
                            fontWeight: "700",
                          }}
                        >
                          ✓
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          {/* Confirm */}
          <Pressable
            style={[
              s.modalDoneBtn,
              {
                backgroundColor: modalSelectedIds.length
                  ? colors.primary
                  : colors.surface,
                borderColor: colors.border,
              },
            ]}
            disabled={modalSelectedIds.length === 0}
            onPress={handleConfirmAddExercises}
          >
            <Text
              style={{
                color:
                  modalSelectedIds.length > 0
                    ? colors.subtle ?? "#fff"
                    : colors.subtle,
                fontWeight: "700",
              }}
            >
              Add {modalSelectedIds.length || ""} exercise
              {modalSelectedIds.length === 1 ? "" : "s"}
            </Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* ===== styles ===== */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      alignItems: "center",
      justifyContent: "center",
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    h2: { fontSize: 20, fontWeight: "800", color: colors.text },
    label: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    muted: { color: colors.subtle },
    generatedTag: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.surface,
      color: colors.subtle,
      fontSize: 12,
      fontWeight: "700",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    saveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnText: {
      color: colors.subtle,
      fontWeight: "800",
      fontSize: 14,
      textAlign: "center",
    },
    addExerciseBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    addExerciseText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 12,
    },
    exerciseRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 8,
      backgroundColor: colors.surface,
      gap: 8,
    },
    exerciseName: {
      color: colors.text,
      fontWeight: "600",
    },
    exerciseNote: {
      marginTop: 2,
      fontSize: 12,
      color: colors.subtle,
    },
    remove: {
      color: colors.danger ?? "#ef4444",
      fontSize: 12,
      fontWeight: "700",
      marginRight: 8,
    },
    dragHandle: {
      color: colors.subtle,
      fontSize: 18,
      paddingHorizontal: 4,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    // Modal styles
    modalSafeArea: {
      flex: 1,
      paddingHorizontal: 16,
    },
    filterBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
    },
    filterPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 6,
      paddingHorizontal: 10,
      gap: 6,
    },
    filterPillLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    filterPillCount: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.subtle,
    },
    filterSummaryText: {
      fontSize: 12,
      color: colors.subtle,
      marginBottom: 6,
      textAlign: "center",
    },
    chipSection: {
      marginBottom: 6,
    },
    chip: {
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    chipLabel: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "600",
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 10,
      columnGap: 12,
      marginBottom: 4,
    },
    modalRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    modalExerciseName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    modalExerciseMeta: {
      fontSize: 12,
      color: colors.subtle,
      marginTop: 2,
    },
    modalDoneBtn: {
      marginTop: 4,
      marginBottom: 12,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    modalClose: {
      fontSize: 14,
      fontWeight: "700",
    },
    modalSearchInput: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 8,
    },
  });
