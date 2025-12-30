import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/authContext";
import { useAppTheme } from "../../../lib/useAppTheme";

/* ---------- types ---------- */

type ExerciseOption = {
  id: string;
  name: string;
  type: string | null;
  equipment: string | null;
};

type WorkoutExerciseEdit = {
  key: string; // stable key for drag list
  exerciseId: string;
  name: string;
};

/* ---------- muscle + equipment filters (same as create) ---------- */

const MUSCLE_GROUPS = [
  {
    id: "chest",
    label: "Chest",
    muscleIds: [1], // Chest
  },
  {
    id: "back",
    label: "Back",
    muscleIds: [2, 88, 89, 90, 99, 98], // Back, Lats, Upper Back, Lower Back, Rear Delts, Traps
  },
  {
    id: "shoulders",
    label: "Shoulders",
    muscleIds: [8], // Shoulders
  },
  {
    id: "biceps",
    label: "Biceps",
    muscleIds: [6, 91], // Biceps, Forearms
  },
  {
    id: "triceps",
    label: "Triceps",
    muscleIds: [7], // Triceps
  },
  {
    id: "core",
    label: "Abs / Core",
    muscleIds: [96, 97, 10, 100, 101], // Abs, Obliques, Core, Core Stabilizers, Serratus
  },
  {
    id: "quads",
    label: "Quads",
    muscleIds: [3, 92], // Quads, Quadriceps
  },
  {
    id: "hamstrings",
    label: "Hamstrings",
    muscleIds: [4], // Hamstrings
  },
  {
    id: "glutes_hips",
    label: "Glutes & Hips",
    muscleIds: [5, 94, 93, 95], // Glutes, Abductors, Adductors, Hip Flexors
  },
  {
    id: "calves",
    label: "Calves",
    muscleIds: [9], // Calves
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

/* ---------- Screen ---------- */

export default function EditWorkoutScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [initialLoading, setInitialLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [selectedExercises, setSelectedExercises] = useState<
    WorkoutExerciseEdit[]
  >([]);

  // modal state
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exLoading, setExLoading] = useState(false);
  const [modalSelectedIds, setModalSelectedIds] = useState<string[]>([]);

  // filters
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(
    []
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [muscleFilterOpen, setMuscleFilterOpen] = useState(false);
  const [equipmentFilterOpen, setEquipmentFilterOpen] = useState(false);

  const canSave =
    !!userId &&
    !!workoutId &&
    title.trim().length > 0 &&
    selectedExercises.length > 0 &&
    !saving &&
    !deleting;

  /* ---------- initial load of workout ---------- */

  const loadWorkout = useCallback(async () => {
    if (!userId || !workoutId) {
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          `
          id,
          title,
          notes,
          workout_exercises (
            id,
            order_index,
            exercises (
              id,
              name
            )
          )
        `
        )
        .eq("id", workoutId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setInitialLoading(false);
        return;
      }

      setTitle(data.title ?? "");
      setNotes(data.notes ?? "");

      const exs = (data.workout_exercises ?? [])
        .map((we: any) => {
          if (!we.exercises) return null;
          return {
            key: String(we.id), // use existing row id as stable key
            exerciseId: String(we.exercises.id),
            name: we.exercises.name ?? "Exercise",
            order_index: we.order_index ?? 0,
          };
        })
        .filter(Boolean)
        .sort(
          (a: any, b: any) =>
            (a.order_index as number) - (b.order_index as number)
        )
        .map((row: any) => ({
          key: row.key,
          exerciseId: row.exerciseId,
          name: row.name,
        })) as WorkoutExerciseEdit[];

      setSelectedExercises(exs);
    } catch (e) {
      console.warn("edit workout load error", e);
    } finally {
      setInitialLoading(false);
    }
  }, [userId, workoutId]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  /* ---------- filter toggles ---------- */

  const toggleMuscleGroup = (groupId: string) => {
    setSelectedMuscleGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleEquipment = (eq: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  /* ---------- load exercise options for picker ---------- */

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

  /* ---------- modal selection / confirm ---------- */

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

      const newItems: WorkoutExerciseEdit[] = [];
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

  /* ---------- save + delete ---------- */

  const handleSave = async () => {
    if (!canSave || !userId || !workoutId) return;

    try {
      setSaving(true);

      // 1) update workout title + notes
      const { error: wErr } = await supabase
        .from("workouts")
        .update({
          title: title.trim(),
          notes: notes.trim() || null,
        })
        .eq("id", workoutId)
        .eq("user_id", userId);

      if (wErr) throw wErr;

      // 2) reset workout_exercises → delete + re-insert with new order
      const { error: delErr } = await supabase
        .from("workout_exercises")
        .delete()
        .eq("workout_id", workoutId);

      if (delErr) throw delErr;

      const inserts = selectedExercises.map((ex, idx) => ({
        workout_id: workoutId,
        exercise_id: ex.exerciseId,
        order_index: idx,
      }));

      if (inserts.length) {
        const { error: insErr } = await supabase
          .from("workout_exercises")
          .insert(inserts);
        if (insErr) throw insErr;
      }

      router.back();
    } catch (e) {
      console.warn("save edited workout error", e);
      Alert.alert(
        "Could not save",
        "Something went wrong saving this workout. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete workout?",
      "This will remove the workout. This can’t be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDelete,
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!userId || !workoutId) return;

    try {
      setDeleting(true);

      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId)
        .eq("user_id", userId);

      if (error) {
        console.warn("delete workout error", error);
        Alert.alert(
          "Could not delete",
          "This workout may be used in a plan or history. Check your plan or try again."
        );
        return;
      }

      router.back();
    } catch (e) {
      console.warn("delete workout error", e);
      Alert.alert(
        "Could not delete",
        "Something went wrong deleting this workout."
      );
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- render ---------- */

  if (!userId) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <Text style={s.muted}>Sign in to edit workouts.</Text>
      </SafeAreaView>
    );
  }

  if (initialLoading) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!workoutId) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <Text style={s.muted}>Workout not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header with Delete on right */}
      <View style={s.headerBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={s.headerSide}
        >
          <Text style={[s.backArrow, { color: colors.text }]}>‹</Text>
        </Pressable>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            Edit Workout
          </Text>
        </View>

        <View style={s.headerSide}>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={[
              s.deleteBtn,
              { opacity: deleting ? 0.5 : 1 },
            ]}
          >
            <Text style={s.deleteBtnText}>
              {deleting ? "Deleting…" : "Delete"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      >
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
          <Text style={[s.muted, { marginTop: 6 }]}>
            Update the name so you can quickly find this workout.
          </Text>
        </View>

        {/* Exercises */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.label}>Exercises</Text>
            <Pressable
              onPress={() => setExerciseModalVisible(true)}
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
            <DraggableFlatList<WorkoutExerciseEdit>
              data={selectedExercises}
              keyExtractor={(item) => item.key}
              scrollEnabled={false}
              onDragEnd={({ data }: { data: WorkoutExerciseEdit[] }) =>
                setSelectedExercises(data)
              }
              renderItem={({
                item,
                drag,
                isActive,
              }: RenderItemParams<WorkoutExerciseEdit>) => (
                <Pressable
                  onLongPress={drag}
                  disabled={isActive}
                  style={[
                    s.exerciseRow,
                    isActive && { backgroundColor: colors.surface },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.exerciseName}>{item.name}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemoveExercise(item.key)}
                    hitSlop={10}
                  >
                    <Text style={s.remove}>Remove</Text>
                  </Pressable>
                  <Text style={s.dragHandle}>≡</Text>
                </Pressable>
              )}
            />
          )}
        </View>

        {/* Notes */}
        <View style={s.card}>
          <Text style={s.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Instructions, tempo, RPE targets..."
            placeholderTextColor={colors.subtle}
            style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
            multiline
          />
        </View>

        {/* Save */}
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[s.saveBtn, !canSave && { opacity: 0.4 }]}
        >
          <Text style={s.saveBtnText}>
            {canSave ? "Save Changes" : "Add a title & at least one exercise"}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Exercise Picker Modal */}
      <Modal
        visible={exerciseModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setExerciseModalVisible(false)}
      >
        <SafeAreaView
          style={[
            s.modalSafeArea,
            { paddingTop: insets.top, backgroundColor: colors.background },
          ]}
        >
          {/* Header */}
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

          {/* MUSCLE FILTERS */}
          <View style={{ marginTop: 8 }}>
            <View style={s.filterHeaderRow}>
              <Text style={s.filterLabel}>Muscles</Text>
              <Pressable
                onPress={() => setMuscleFilterOpen((open) => !open)}
                style={s.filterToggle}
                hitSlop={8}
              >
                <Text style={s.filterToggleText}>
                  {muscleFilterOpen ? "Hide" : "Select muscles"}
                </Text>
              </Pressable>
            </View>

            {muscleFilterOpen && (
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
                          backgroundColor: colors.primaryBg ?? colors.primary,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.chipLabel,
                          active && {
                            color: colors.primaryText ?? "#fff",
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
            )}
          </View>

          {/* EQUIPMENT FILTERS */}
          <View style={{ marginTop: 8 }}>
            <View style={s.filterHeaderRow}>
              <Text style={s.filterLabel}>Equipment</Text>
              <Pressable
                onPress={() => setEquipmentFilterOpen((open) => !open)}
                style={s.filterToggle}
                hitSlop={8}
              >
                <Text style={s.filterToggleText}>
                  {equipmentFilterOpen ? "Hide" : "Select equipment"}
                </Text>
              </Pressable>
            </View>

            {equipmentFilterOpen && (
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
                          backgroundColor: colors.primaryBg ?? colors.primary,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.chipLabel,
                          active && {
                            color: colors.primaryText ?? "#fff",
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
            )}
          </View>

          {/* Summary text under filters */}
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

          {/* Exercise list */}
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
                            color: colors.subtle ?? "#fff",
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

/* ---------- styles ---------- */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    label: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
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

    // Header
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerSide: {
      width: 80,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    backArrow: { fontSize: 28, fontWeight: "600" },
    headerCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      height: 44,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },
    deleteBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.dangerBg ?? "#451a1a",
      borderColor: colors.danger ?? "#ef4444",
    },
    deleteBtnText: {
      color: colors.danger ?? "#ef4444",
      fontWeight: "700",
      fontSize: 12,
    },

    // Modal styles
    modalSafeArea: {
      flex: 1,
      paddingHorizontal: 16,
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
      paddingVertical: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 8,
    },

    chip: {
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    chipLabel: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "600",
    },
    filterHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    filterLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    filterToggle: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterToggleText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 10, // a bit more spacing than before
      columnGap: 12,
      marginBottom: 4,
    },
    filterSummaryText: {
      marginTop: 4,
      marginBottom: 4,
      textAlign: "center",
      fontSize: 11,
      color: colors.subtle,
    },

    modalRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 8,
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
  });
