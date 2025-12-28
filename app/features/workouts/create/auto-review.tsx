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
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type {
  GeneratedWorkout,
  GeneratedWorkoutExercise,
} from "./workoutGenerator";

// ✅ import shared picker
import { ExercisePickerModal } from "../../../_components/ExercisePickerModal";

type ExerciseOption = {
  id: string;
  name: string | null; // ✅ match shared modal type
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
  { id: "chest", label: "Chest", muscleIds: [1] },
  { id: "back", label: "Back", muscleIds: [2, 88, 89, 90, 99, 98] },
  { id: "shoulders", label: "Shoulders", muscleIds: [8] },
  { id: "biceps", label: "Biceps", muscleIds: [6, 91] },
  { id: "triceps", label: "Triceps", muscleIds: [7] },
  { id: "core", label: "Abs / Core", muscleIds: [96, 97, 10, 100, 101] },
  { id: "quads", label: "Quads", muscleIds: [3, 92] },
  { id: "hamstrings", label: "Hamstrings", muscleIds: [4] },
  { id: "glutes_hips", label: "Glutes & Hips", muscleIds: [5, 94, 93, 95] },
  { id: "calves", label: "Calves", muscleIds: [9] },
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

  // multi-select filters (controlled by screen)
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(
    []
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // collapsible filters
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
                exercise_muscles!inner(muscle_id)
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

  // ✅ updated: accept ids from ExercisePickerModal
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
          note: null,
        });
      });

      return [...prev, ...newItems];
    });

    setExerciseModalVisible(false);

    // optional reset (matches your other screen)
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

        {/* Overall notes */}
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

        {/* Selected exercises */}
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

      {/* ✅ Shared Exercise Picker Modal */}
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

/* ===== styles ===== */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: "center", justifyContent: "center" },
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
    exerciseName: { color: colors.text, fontWeight: "600" },
    exerciseNote: { marginTop: 2, fontSize: 12, color: colors.subtle },
    remove: {
      color: colors.danger ?? "#ef4444",
      fontSize: 12,
      fontWeight: "700",
      marginRight: 8,
    },
  });
