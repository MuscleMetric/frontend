import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { ExercisePickerModal } from "../../../_components/ExercisePickerModal";

type ExerciseOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
};

type WorkoutExercise = {
  key: string; // stable key for drag list
  exerciseId: string;
  name: string;
};

/* ---------- muscle + equipment filters ---------- */

// 10 muscle group chips (using your exact muscle IDs / names)
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

// exact equipment list you gave (no additions / renames)
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

export default function CreateWorkoutScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const insets = useSafeAreaInsets();

  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>(
    []
  );

  // modal state
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exLoading, setExLoading] = useState(false);

  // NEW: multi-select filters
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(
    []
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // NEW: collapsible filters
  const [muscleFilterOpen, setMuscleFilterOpen] = useState(false);
  const [equipmentFilterOpen, setEquipmentFilterOpen] = useState(false);

  const [usageByExerciseId, setUsageByExerciseId] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    let alive = true;
    if (!exerciseModalVisible || !userId) return;

    (async () => {
      const { data, error } = await supabase
        .from("exercise_usage")
        .select("exercise_id,sessions_count")
        .eq("user_id", userId);

      if (error) {
        console.warn("usage load error", error);
        if (alive) setUsageByExerciseId({});
        return;
      }

      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.exercise_id] = r.sessions_count ?? 0;
      });

      if (alive) setUsageByExerciseId(map);
    })();

    return () => {
      alive = false;
    };
  }, [exerciseModalVisible, userId]);

  // ----- derived -----
  const canSave =
    !!userId &&
    title.trim().length > 0 &&
    selectedExercises.length > 0 &&
    !saving;

  // ----- muscle filter toggle -----
  const toggleMuscleGroup = (groupId: string) => {
    setSelectedMuscleGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  // ----- equipment filter toggle -----
  const toggleEquipment = (eq: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  // ----- load exercises for picker when modal is open or filters/search change -----
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
          .or(`is_public.eq.true,user_id.eq.${userId}`)
          .order("name", { ascending: true })
          .limit(600);

        if (exerciseSearch.trim()) {
          q = q.ilike("name", `%${exerciseSearch.trim()}%`);
        }

        // equipment filter (multi)
        if (selectedEquipment.length > 0) {
          q = q.in("equipment", selectedEquipment);
        }

        // muscle filter (multi) via exercise_muscles
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
              id: String(row.id),
              name: row.name ?? null,
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

  const handleConfirmAddExercises = (selectedIds: string[]) => {
    if (!selectedIds.length) return;

    setSelectedExercises((prev) => {
      const existingIds = new Set(prev.map((e) => e.exerciseId));
      const now = Date.now();

      const newItems: WorkoutExercise[] = [];
      selectedIds.forEach((id, idx) => {
        if (existingIds.has(id)) return;
        const ex = exerciseOptions.find((er) => er.id === id);
        if (!ex) return;

        newItems.push({
          key: `${id}-${now}-${idx}`,
          exerciseId: id,
          name: ex.name ?? "Exercise",
        });
      });

      return [...prev, ...newItems];
    });

    setExerciseModalVisible(false);

    // optional reset like before
    setExerciseSearch("");
    setSelectedMuscleGroups([]);
    setSelectedEquipment([]);
    setMuscleFilterOpen(false);
    setEquipmentFilterOpen(false);
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
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (wErr) throw wErr;

      const workoutId = wData.id as string;

      const inserts = selectedExercises.map((ex, idx) => ({
        workout_id: workoutId,
        exercise_id: ex.exerciseId,
        order_index: idx,
      }));

      if (inserts.length) {
        const { error: weErr } = await supabase
          .from("workout_exercises")
          .insert(inserts);
        if (weErr) throw weErr;
      }

      router.back();
    } catch (e) {
      console.warn("save workout error", e);
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <Text style={s.muted}>Sign in to create workouts.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      >
        <View style={{ marginBottom: 4 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 16,
                fontWeight: "700",
                marginRight: 4,
              }}
            >
              ←
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              Back
            </Text>
          </Pressable>
        </View>
        {/* Header */}
        <View style={s.rowBetween}>
          <Text style={s.h2}>Create Workout</Text>
        </View>

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
            Give this workout a clear name so you can re-use it easily.
          </Text>
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

        {/* Optional notes */}
        <View style={s.card}>
          <Text style={s.label}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any instructions, tempo, RPE targets..."
            placeholderTextColor={colors.subtle}
            style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
            multiline
          />
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
      <ExercisePickerModal
        userId={userId}
        alreadyInWorkoutIds={selectedExercises.map((e) => e.exerciseId)}
        usageByExerciseId={usageByExerciseId}
        visible={exerciseModalVisible}
        title="Select exercises"
        loading={exLoading}
        exerciseOptions={exerciseOptions}
        muscleGroups={MUSCLE_GROUPS as any}
        equipmentOptions={EQUIPMENT_OPTIONS}
        multiSelect={true}
        initialSelectedIds={[]}
        onClose={() => setExerciseModalVisible(false)}
        onConfirm={(ids) => handleConfirmAddExercises(ids)}
        search={exerciseSearch}
        onChangeSearch={setExerciseSearch}
        selectedMuscleGroups={selectedMuscleGroups}
        toggleMuscleGroup={toggleMuscleGroup}
        muscleFilterOpen={muscleFilterOpen}
        setMuscleFilterOpen={setMuscleFilterOpen}
        selectedEquipment={selectedEquipment}
        toggleEquipment={toggleEquipment}
        equipmentFilterOpen={equipmentFilterOpen}
        setEquipmentFilterOpen={setEquipmentFilterOpen}
        styles={s}
        colors={colors}
        safeAreaTop={insets.top}
      />
    </SafeAreaView>
  );
}

// ===== styles =====
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
    h3: { fontSize: 18, fontWeight: "800", color: colors.text },
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

    // Modal styles
    modalSafeArea: {
      flex: 1,
      paddingHorizontal: 16,
    },

    filterBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8, // space between the two filter pills
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
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    filterPillCount: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.subtle,
    },

    filterSummaryText: {
      fontSize: 15,
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

    // increased gapping between chips
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 10, // was 6 → +4
      columnGap: 12, // was 8 → +4
      marginBottom: 4,
    },

    // exercise rows in modal list: stronger separation
    modalRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1, // was hairline → clearer border
      borderColor: colors.border,
      marginBottom: 12, // was 8 → more gap between rows
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
  });
