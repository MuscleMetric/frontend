// app/features/plans/create/Workout.tsx
import { useLocalSearchParams, router } from "expo-router";
import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useEditPlan, type ExerciseRow } from "./store";
import { CachedExercise, useExercisesCache } from "../create/exercisesStore";
import { nanoid } from "nanoid/non-secure";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { supabase } from "../../../../lib/supabase";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ExercisePickerModal } from "../../../_components/ExercisePickerModal";
import { useAuth } from "../../../../lib/authContext";

/* ---------- muscle + equipment filters (shared) ---------- */

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

/* ---------- picker option type ---------- */

type ExerciseOption = {
  id: string;
  name: string | null;
  type: "strength" | "cardio" | "mobility" | null;
  equipment: string | null;
};

export default function WorkoutPage() {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { index: idxParam } = useLocalSearchParams<{ index: string }>();
  const index = Number(idxParam ?? 0);

  const { workoutsPerWeek, workouts, setWorkout } = useEditPlan();
  const draft = workouts?.[index];

  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Guard
  if (!Number.isFinite(index) || !draft) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const exercises = draft.exercises ?? [];

  /* ---------- cache loading (unchanged) ---------- */

  const { items: all, setItems } = useExercisesCache();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (all.length > 0) return;

      try {
        const list = await fetchAllExercises();
        if (!cancelled) setItems(list);
      } catch (e) {
        console.warn("Failed to load exercises:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [all.length, setItems]);

  async function fetchAllExercises(): Promise<CachedExercise[]> {
    const pageSize = 500;
    let from = 0;
    const out: CachedExercise[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("v_exercises_compact")
        .select("id,name,type,primary_muscle,popularity")
        .order("popularity", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const chunk = (data ?? []) as CachedExercise[];
      out.push(...chunk);

      if (chunk.length < pageSize) break;
      from += pageSize;
    }

    return out;
  }

  /* ---------- prevent duplicates within this workout ---------- */

  const hasExercise = useCallback(
    (exerciseId: string) =>
      draft.exercises.some((e) => e.exercise.id === exerciseId),
    [draft.exercises]
  );

  /* ---------- Superset selection (unchanged behaviour) ---------- */

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleSelect(exerciseId: string | null | undefined) {
    if (!exerciseId) return;
    setSelectedIds((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((k) => k !== exerciseId)
        : [...prev, exerciseId]
    );
  }

  function makeSuperset() {
    if (selectedIds.length < 2) {
      Alert.alert("Pick at least 2 exercises to create a superset.");
      return;
    }

    const groupId = `ss-${nanoid(6)}`;
    const updated = draft.exercises.map((ex) =>
      selectedIds.includes(ex.exercise.id)
        ? { ...ex, supersetGroup: groupId }
        : ex
    );

    setWorkout(index, { ...draft, exercises: updated });
    setSelecting(false);
    setSelectedIds([]);
  }

  function clearSupersetForSelected() {
    if (selectedIds.length === 0) return;

    const updated = draft.exercises.map((ex) =>
      selectedIds.includes(ex.exercise.id) ? { ...ex, supersetGroup: null } : ex
    );

    setWorkout(index, { ...draft, exercises: updated });
    setSelecting(false);
    setSelectedIds([]);
  }

  useEffect(() => {
    if (!Number.isFinite(index) || !workouts?.[index]) {
      router.replace("/features/plans/create/planInfo");
    }
  }, [index, workouts]);

  /* ---------- Drag handler: keep order_index in sync ---------- */

  const handleDragEnd = useCallback(
    ({ data }: { data: typeof draft.exercises }) => {
      const reindexed = data.map((ex, i) => ({ ...ex, order_index: i }));
      setWorkout(index, { ...draft, exercises: reindexed });
    },
    [draft, index, setWorkout]
  );

  /* ---------- Superset colors (unchanged) ---------- */

  const SUPERSET_COLORS = [
    "#2563eb",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
  ];

  const supersetGroups = useMemo(
    () => [
      ...new Set(
        exercises.map((x) => x.supersetGroup).filter(Boolean) as string[]
      ),
    ],
    [exercises]
  );

  /* ---------- NEW: ExercisePickerModal state ---------- */

  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");

  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(
    []
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

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

  // Build options from cache + local filtering
  const exerciseOptions: ExerciseOption[] = useMemo(() => {
    let pool = all;

    const q = exerciseSearch.trim().toLowerCase();
    if (q) pool = pool.filter((e) => e.name.toLowerCase().includes(q));

    // Equipment filtering:
    // v_exercises_compact doesn't currently include equipment, so we can't filter it here.
    // If you add equipment to the view or cache store, implement filtering here.
    // if (selectedEquipment.length) { ... }

    // Muscle filtering using primary_muscle string match
    if (selectedMuscleGroups.length) {
      const selectedLabels = selectedMuscleGroups
        .map((gid) => MUSCLE_GROUPS.find((g) => g.id === gid)?.label)
        .filter(Boolean)
        .map((x) => String(x).toLowerCase());

      pool = pool.filter((e) => {
        const pm = (e.primary_muscle ?? "").toLowerCase();

        // special-case Back cluster like you had before
        if (selectedLabels.includes("back")) {
          return (
            pm.includes("lat") ||
            pm.includes("upper back") ||
            pm.includes("lower back") ||
            pm === "back"
          );
        }

        return selectedLabels.some((lbl) => pm.includes(lbl));
      });
    }

    // remove already-added exercises
    pool = pool.filter((e) => !hasExercise(e.id));

    // keep list reasonable for modal perf
    const top = pool.slice(0, 600);

    return top.map((e) => ({
      id: e.id,
      name: e.name ?? null,
      type: (e.type as any) ?? null,
      equipment: null,
    }));
  }, [all, exerciseSearch, selectedMuscleGroups, hasExercise]);

  const handleConfirmAddExercises = (selectedIds: string[]) => {
    if (!selectedIds.length) {
      setExerciseModalVisible(false);
      return;
    }

    const existingIds = new Set(draft.exercises.map((e) => e.exercise.id));

    const toAdd = selectedIds
      .filter((id) => !existingIds.has(id))
      .map((id) => {
        const ex = exerciseOptions.find((x) => x.id === id);
        if (!ex) return null;

        return {
          exercise: {
            id: ex.id,
            name: ex.name ?? "Exercise",
            type: ex.type,
          } as ExerciseRow,
          order_index: 0,
          supersetGroup: null,
          isDropset: false,
        };
      })
      .filter(Boolean) as typeof draft.exercises;

    if (!toAdd.length) {
      setExerciseModalVisible(false);
      return;
    }

    const merged = [...draft.exercises, ...toAdd].map((e, i) => ({
      ...e,
      order_index: i,
    }));

    setWorkout(index, { ...draft, exercises: merged });

    // reset + close
    setExerciseModalVisible(false);
    setExerciseSearch("");
    setSelectedMuscleGroups([]);
    setSelectedEquipment([]);
    setMuscleFilterOpen(false);
    setEquipmentFilterOpen(false);
  };

  /* ---------- In edit mode we just confirm and go back ---------- */

  function updateAndReturn() {
    if (!draft.title.trim()) {
      Alert.alert("Add a workout title");
      return;
    }
    if (draft.exercises.length === 0) {
      Alert.alert("Add at least one exercise");
      return;
    }
    Alert.alert("Updated", "Workout changes saved.");
    router.back();
  }

  /* ---------- render ---------- */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.h2}>
          Update Workout {index + 1} of {workoutsPerWeek}
        </Text>

        <Text style={s.label}>Title</Text>
        <TextInput
          style={s.input}
          value={draft.title}
          onChangeText={(t) => setWorkout(index, { ...draft, title: t })}
          placeholder="e.g. Push, Pull, Legs…"
          placeholderTextColor={colors.subtle}
        />

        <Text style={s.label}>Exercises</Text>

        {/* Superset toolbar when selecting */}
        {selecting && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <Pressable style={[s.btn, s.primary]} onPress={makeSuperset}>
              <Text style={s.btnPrimaryText}>Create Superset</Text>
            </Pressable>
            <Pressable style={s.btn} onPress={clearSupersetForSelected}>
              <Text style={s.btnText}>Ungroup</Text>
            </Pressable>
            <Pressable
              style={s.btn}
              onPress={() => {
                setSelecting(false);
                setSelectedIds([]);
              }}
            >
              <Text style={s.btnText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* DRAGGABLE EXERCISE LIST */}
        {draft.exercises.length > 0 && (
          <View style={{ maxHeight: 420, marginBottom: 8 }}>
            <View style={{ marginBottom: 8 }}>
              <DraggableFlatList
                data={draft.exercises}
                keyExtractor={(item, idx) => item.exercise.id ?? `ex-${idx}`}
                scrollEnabled={false}
                onDragEnd={handleDragEnd}
                renderItem={({
                  item,
                  drag,
                  isActive,
                }: RenderItemParams<(typeof draft.exercises)[number]>) => {
                  const displayIndex =
                    typeof item.order_index === "number"
                      ? item.order_index + 1
                      : 1;

                  const exId = item.exercise.id;
                  const isSelected = exId ? selectedIds.includes(exId) : false;
                  const group = item.supersetGroup ?? null;

                  const groupIndex = group ? supersetGroups.indexOf(group) : -1;
                  const groupLabel =
                    groupIndex >= 0
                      ? String.fromCharCode(65 + groupIndex)
                      : null;
                  const groupColor =
                    groupIndex >= 0
                      ? SUPERSET_COLORS[groupIndex % SUPERSET_COLORS.length]
                      : null;

                  const findIndexInDraft = () =>
                    draft.exercises.findIndex(
                      (ex) =>
                        ex.exercise.id === item.exercise.id &&
                        ex.order_index === item.order_index
                    );

                  return (
                    <View
                      style={[
                        s.item,
                        groupColor && {
                          borderColor: groupColor,
                          borderWidth: 2,
                        },
                        isSelected && {
                          borderColor: colors.primary,
                          borderWidth: 3,
                        },
                      ]}
                    >
                      <Pressable
                        onLongPress={() => {
                          if (selecting) {
                            toggleSelect(exId);
                          } else {
                            drag();
                          }
                        }}
                        delayLongPress={120}
                        onPress={() => {
                          if (selecting) toggleSelect(exId);
                        }}
                        style={{ flex: 1, opacity: isActive ? 0.8 : 1 }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{ fontWeight: "700", color: colors.text }}
                            >
                              {displayIndex}. {item.exercise.name}
                              {groupLabel ? (
                                <Text
                                  style={{
                                    fontWeight: "800",
                                    color: groupColor ?? colors.text,
                                  }}
                                >
                                  {`  •  Superset ${groupLabel}`}
                                </Text>
                              ) : null}
                            </Text>

                            <View
                              style={{
                                flexDirection: "row",
                                gap: 8,
                                marginTop: 4,
                                flexWrap: "wrap",
                              }}
                            >
                              {!!item.exercise.type && (
                                <Text style={{ color: colors.subtle }}>
                                  {item.exercise.type}
                                </Text>
                              )}
                              {item.isDropset && (
                                <Text
                                  style={{
                                    color: colors.primaryText,
                                    fontWeight: "700",
                                  }}
                                >
                                  • Dropset
                                </Text>
                              )}
                            </View>

                            <Text
                              style={{ color: colors.subtle, marginTop: 4 }}
                            >
                              Exercise selected
                            </Text>
                          </View>

                          <View style={{ gap: 6, alignItems: "flex-end" }}>
                            <Pressable
                              onPress={() => {
                                const idx = findIndexInDraft();
                                if (idx < 0) return;
                                const copy = [...draft.exercises];
                                copy[idx] = {
                                  ...copy[idx],
                                  isDropset: !copy[idx].isDropset,
                                };
                                setWorkout(index, {
                                  ...draft,
                                  exercises: copy,
                                });
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.primary,
                                  fontWeight: "700",
                                }}
                              >
                                {item.isDropset
                                  ? "Remove Dropset"
                                  : "Mark as Dropset"}
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => {
                                const idx = findIndexInDraft();
                                if (idx < 0) return;
                                const copy = [...draft.exercises];
                                copy.splice(idx, 1);
                                const reindexed = copy.map((x, j) => ({
                                  ...x,
                                  order_index: j,
                                }));
                                setWorkout(index, {
                                  ...draft,
                                  exercises: reindexed,
                                });
                              }}
                              hitSlop={10}
                            >
                              <Text
                                style={{
                                  color: colors.danger,
                                  fontWeight: "700",
                                }}
                              >
                                Remove
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  );
                }}
              />
            </View>
          </View>
        )}

        {/* Controls */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Pressable
            style={[s.btn, s.primary]}
            onPress={() => setExerciseModalVisible(true)}
          >
            <Text style={s.btnPrimaryText}>＋ Add Exercise</Text>
          </Pressable>

          {!selecting ? (
            <Pressable
              style={[s.btn, draft.exercises.length < 2 && { opacity: 0.5 }]}
              disabled={draft.exercises.length < 2}
              onPress={() => setSelecting(true)}
            >
              <Text style={s.btnText}>Select for Superset</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Bottom actions */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          {index > 0 && (
            <Pressable style={s.btn} onPress={() => router.back()}>
              <Text style={s.btnText}>← Back</Text>
            </Pressable>
          )}
          <Pressable
            style={[s.btn, s.primary, { flex: 1 }]}
            onPress={updateAndReturn}
          >
            <Text style={s.btnPrimaryText}>Update Workout</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Shared picker modal */}
      <ExercisePickerModal
        userId={userId}
        alreadyInWorkoutIds={draft.exercises.map((e) => e.exercise.id)}
        usageByExerciseId={usageByExerciseId}
        visible={exerciseModalVisible}
        title="Add Exercise"
        loading={all.length === 0}
        exerciseOptions={exerciseOptions}
        muscleGroups={MUSCLE_GROUPS as any}
        equipmentOptions={EQUIPMENT_OPTIONS}
        initialSelectedIds={[]}
        multiSelect={true}
        onClose={() => setExerciseModalVisible(false)}
        onConfirm={handleConfirmAddExercises}
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

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    h2: {
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 12,
      color: colors.text,
    },
    h3: {
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 8,
      color: colors.text,
    },
    label: {
      fontWeight: "700",
      marginTop: 12,
      marginBottom: 6,
      color: colors.text,
    },

    input: {
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
    },

    item: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    row: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: { fontWeight: "700", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "800" },
  });
