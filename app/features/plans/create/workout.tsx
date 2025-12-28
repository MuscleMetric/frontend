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
import { usePlanDraft, type ExerciseRow, type WorkoutExercise } from "./store";
import { nanoid } from "nanoid/non-secure";
import { useAppTheme } from "../../../../lib/useAppTheme";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { supabase } from "../../../../lib/supabase";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ExercisePickerModal } from "../../../_components/ExercisePickerModal";
import { useAuth } from "../../../../lib/authContext";

/* ---------- local row types ---------- */

type PlanExerciseRow = WorkoutExercise;

type SupersetRow = {
  key: string;
  items: PlanExerciseRow[]; // either 1 (normal) or >1 (superset group)
};

/* ---------- picker types ---------- */

type ExerciseOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
};

/* ---------- muscle + equipment filters (same as index.tsx) ---------- */

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
    muscleIds: [8],
  },
  {
    id: "biceps",
    label: "Biceps",
    muscleIds: [6, 91], // Biceps, Forearms
  },
  {
    id: "triceps",
    label: "Triceps",
    muscleIds: [7],
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
    muscleIds: [4],
  },
  {
    id: "glutes_hips",
    label: "Glutes & Hips",
    muscleIds: [5, 94, 93, 95], // Glutes, Abductors, Adductors, Hip Flexors
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

function normalizeExerciseType(raw: string | null): ExerciseRow["type"] {
  if (raw === "strength" || raw === "cardio" || raw === "mobility") {
    return raw;
  }
  return null;
}

export default function WorkoutPage() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const insets = useSafeAreaInsets();

  const { index: idxParam } = useLocalSearchParams<{ index: string }>();
  const index = Number(idxParam ?? 0);

  const { workoutsPerWeek, workouts, setWorkout } = usePlanDraft();
  const draft = workouts?.[index] ?? null;
  const exercises: PlanExerciseRow[] = draft?.exercises ?? [];

  /* ---------- helpers for identifying rows ---------- */

  const rowKey = (ex: PlanExerciseRow, fallbackIndex: number) =>
    `${ex.exercise.id ?? "NA"}-${
      typeof ex.order_index === "number" ? ex.order_index : fallbackIndex
    }`;

  const hasExercise = useCallback(
    (exerciseId: string) => exercises.some((e) => e.exercise.id === exerciseId),
    [exercises]
  );

  /* ---------- Superset selection state ---------- */

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleSelect(key: string) {
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function makeSuperset() {
    if (selectedIds.length < 2) {
      Alert.alert("Pick at least 2 exercises to create a superset.");
      return;
    }
    if (!draft) return;
    const groupId = `ss-${nanoid(6)}`;
    const updated = exercises.map((ex, i) =>
      selectedIds.includes(rowKey(ex, i))
        ? { ...ex, supersetGroup: groupId }
        : ex
    );
    setWorkout(index, { ...draft, exercises: updated });
    setSelecting(false);
    setSelectedIds([]);
  }

  function clearSupersetForSelected() {
    if (selectedIds.length === 0 || !draft) return;
    const updated = exercises.map((ex, i) =>
      selectedIds.includes(rowKey(ex, i)) ? { ...ex, supersetGroup: null } : ex
    );
    setWorkout(index, { ...draft, exercises: updated });
    setSelecting(false);
    setSelectedIds([]);
  }

  /* ---------- Dropset & remove handlers ---------- */

  function toggleDropset(exerciseId: string) {
    if (!draft) return;
    const updated = exercises.map((ex) =>
      ex.exercise.id === exerciseId ? { ...ex, isDropset: !ex.isDropset } : ex
    );
    const reindexed = updated.map((e, i) => ({ ...e, order_index: i }));
    setWorkout(index, { ...draft, exercises: reindexed });
  }

  function removeExercise(exerciseId: string) {
    if (!draft) return;
    const updated = exercises.filter((ex) => ex.exercise.id !== exerciseId);
    const reindexed = updated.map((e, i) => ({ ...e, order_index: i }));
    setWorkout(index, { ...draft, exercises: reindexed });
  }

  useEffect(() => {
    if (!Number.isFinite(index) || !workouts?.[index]) {
      router.replace("/features/plans/create/planInfo");
    }
  }, [index, workouts]);

  /* ---------- SUPERCARD ROWS (superset groups drag as one) ---------- */

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

  const supersetColorForGroup = (groupId: string | null | undefined) => {
    if (!groupId) return null;
    const idx = supersetGroups.indexOf(groupId);
    if (idx < 0) return null;
    return SUPERSET_COLORS[idx % SUPERSET_COLORS.length];
  };

  // Build draggable rows: each superset group is a block row
  const draggableRows: SupersetRow[] = useMemo(() => {
    const rows: SupersetRow[] = [];
    let i = 0;
    while (i < exercises.length) {
      const ex = exercises[i];
      if (ex.supersetGroup) {
        const groupId = ex.supersetGroup;
        const items: PlanExerciseRow[] = [ex];
        let j = i + 1;
        while (j < exercises.length && exercises[j].supersetGroup === groupId) {
          items.push(exercises[j]);
          j++;
        }
        rows.push({
          key: `group-${groupId}-${i}`,
          items,
        });
        i = j;
      } else {
        rows.push({
          key: `single-${ex.exercise.id}-${i}`,
          items: [ex],
        });
        i++;
      }
    }
    return rows;
  }, [exercises]);

  /* ---------- Exercise picker modal state ---------- */

  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exLoading, setExLoading] = useState(false);

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

  // Load picker options whenever modal is open or filters change
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
          console.warn("plan workout exercise picker error", error);
          if (alive) setExerciseOptions([]);
          return;
        }

        if (alive) {
          setExerciseOptions(
            (data ?? []).map((row: any) => ({
              id: row.id,
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
    if (!draft) return;
    if (!selectedIds.length) return;

    const existingIds = new Set(exercises.map((e) => e.exercise.id));

    const newRows = selectedIds.reduce<PlanExerciseRow[]>((acc, id) => {
      if (existingIds.has(id)) return acc;
      const ex = exerciseOptions.find((er) => er.id === id);
      if (!ex) return acc;

      acc.push({
        exercise: {
          id: ex.id,
          name: ex.name ?? "Exercise",
          type: normalizeExerciseType(ex.type),
        },
        order_index: 0, // temporary; reindexed below
        supersetGroup: null,
        isDropset: false,
      });

      return acc;
    }, []);

    if (!newRows.length) {
      setExerciseModalVisible(false);
      return;
    }

    const merged = [...exercises, ...newRows].map((row, i) => ({
      ...row,
      order_index: i,
    }));

    setWorkout(index, { ...draft, exercises: merged });

    // reset + close (same pattern as your other screens)
    setExerciseModalVisible(false);
    setExerciseSearch("");
    setSelectedMuscleGroups([]);
    setSelectedEquipment([]);
    setMuscleFilterOpen(false);
    setEquipmentFilterOpen(false);
  };

  /* ---------- navigation ---------- */

  function next() {
    if (!draft) return;
    if (!draft.title.trim()) return Alert.alert("Add a workout title");
    if (exercises.length === 0) return Alert.alert("Add at least one exercise");
    if (index < workoutsPerWeek - 1) {
      router.push({
        pathname: "/features/plans/create/workout",
        params: { index: index + 1 },
      });
    } else {
      router.push("/features/plans/create/goals");
    }
  }

  /* ---------- drag handler (works on grouped rows) ---------- */

  const handleDragEnd = useCallback(
    ({ data }: { data: SupersetRow[] }) => {
      if (!draft) return;
      // Flatten grouped rows back into a single exercise list
      const flattened: PlanExerciseRow[] = data.flatMap((row) => row.items);
      const reindexed = flattened.map((e, i) => ({
        ...e,
        order_index: i,
      }));
      setWorkout(index, { ...draft, exercises: reindexed });
    },
    [draft, index, setWorkout]
  );

  /* ---------- guard AFTER all hooks ---------- */

  const invalid = !Number.isFinite(index) || !draft;

  if (invalid) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
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
          Workout {index + 1} of {workoutsPerWeek}
        </Text>

        <Text style={s.label}>Title</Text>
        <TextInput
          style={s.input}
          value={draft.title}
          onChangeText={(t) => setWorkout(index, { ...draft, title: t })}
          placeholder="e.g. Push, Pull, Legs…"
          placeholderTextColor={colors.subtle}
        />

        {/* Workout-level notes */}
        <Text style={s.label}>Notes (optional)</Text>
        <TextInput
          style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
          value={draft.notes ?? ""}
          placeholder="Any instructions, tempo, warm-up details…"
          placeholderTextColor={colors.subtle}
          multiline
          onChangeText={(t) => setWorkout(index, { ...draft, notes: t })}
        />

        <Text style={s.label}>Exercises</Text>

        {/* Superset toolbar */}
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

        {/* Draggable exercise list – superset groups move as one */}
        {draggableRows.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <DraggableFlatList<SupersetRow>
              data={draggableRows}
              keyExtractor={(row) => row.key}
              scrollEnabled={false}
              activationDistance={4}
              onDragEnd={handleDragEnd}
              renderItem={({
                item,
                drag,
                isActive,
              }: RenderItemParams<SupersetRow>) => {
                const firstEx = item.items[0];
                const groupId = firstEx.supersetGroup ?? null;
                const groupColor = supersetColorForGroup(groupId);
                const isGroup = item.items.length > 1;

                return (
                  <View
                    style={[
                      s.groupCard,
                      groupColor && {
                        borderColor: groupColor,
                        borderWidth: 2,
                      },
                      isActive && { opacity: 0.9 },
                    ]}
                  >
                    {/* Header row: label + drag handle */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: isGroup ? 4 : 0,
                      }}
                    >
                      {isGroup && (
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: groupColor ?? colors.subtle,
                          }}
                        >
                          Superset
                        </Text>
                      )}

                      {/* drag handle */}
                      <Pressable
                        onPressIn={drag}
                        disabled={isActive}
                        hitSlop={10}
                      >
                        <Text
                          style={{
                            color: colors.subtle,
                            fontSize: 18,
                            paddingHorizontal: 4,
                          }}
                        >
                          ≡
                        </Text>
                      </Pressable>
                    </View>

                    {/* Exercises inside this group */}
                    {item.items.map((exRow, idx) => {
                      const displayIndex =
                        typeof exRow.order_index === "number"
                          ? exRow.order_index + 1
                          : 1;

                      const thisRowId = rowKey(exRow, idx);
                      const isSelected = selectedIds.includes(thisRowId);

                      return (
                        <Pressable
                          key={thisRowId}
                          onPress={() => selecting && toggleSelect(thisRowId)}
                          style={[
                            s.item,
                            idx < item.items.length - 1 && {
                              marginBottom: 6,
                            },
                            selecting &&
                              isSelected && {
                                backgroundColor:
                                  colors.primaryBg ?? colors.surface,
                              },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{ fontWeight: "700", color: colors.text }}
                            >
                              {displayIndex}. {exRow.exercise.name}
                            </Text>

                            <View
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 6,
                                marginTop: 4,
                              }}
                            >
                              {exRow.isDropset && (
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: colors.warnText ?? "#f59e0b",
                                  }}
                                >
                                  Dropset
                                </Text>
                              )}
                              {exRow.notes ? (
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: colors.subtle,
                                    flexShrink: 1,
                                  }}
                                  numberOfLines={1}
                                >
                                  {exRow.notes}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <View
                            style={{
                              alignItems: "flex-end",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            {/* Dropset toggle */}
                            <Pressable
                              onPress={() =>
                                toggleDropset(exRow.exercise.id as string)
                              }
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "700",
                                  color: exRow.isDropset
                                    ? colors.warnText ?? "#f59e0b"
                                    : colors.subtle,
                                }}
                              >
                                {exRow.isDropset ? "Dropset ✓" : "Make dropset"}
                              </Text>
                            </Pressable>

                            {/* Remove exercise */}
                            <Pressable
                              onPress={() =>
                                removeExercise(exRow.exercise.id as string)
                              }
                              hitSlop={10}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "700",
                                  color: colors.danger ?? "#ef4444",
                                }}
                              >
                                Remove
                              </Text>
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* Controls */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Pressable
            style={[s.btn, s.primary]}
            onPress={() => setExerciseModalVisible(true)}
          >
            <Text style={s.btnPrimaryText}>＋ Add Exercises</Text>
          </Pressable>

          {!selecting && (
            <Pressable
              style={[s.btn, exercises.length < 2 && { opacity: 0.5 }]}
              disabled={exercises.length < 2}
              onPress={() => setSelecting(true)}
            >
              <Text style={s.btnText}>Select for Superset</Text>
            </Pressable>
          )}
        </View>

        {/* Bottom nav */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          {index > 0 && (
            <Pressable style={s.btn} onPress={() => router.back()}>
              <Text style={s.btnText}>← Back</Text>
            </Pressable>
          )}
          <Pressable style={[s.btn, s.primary, { flex: 1 }]} onPress={next}>
            <Text style={s.btnPrimaryText}>
              {index < workoutsPerWeek - 1 ? "Next Workout →" : "Next → Goals"}
            </Text>
          </Pressable>
        </View>

        {/* FULL-SCREEN EXERCISE PICKER WITH SAFE AREA */}
        <ExercisePickerModal
          userId={userId}
          alreadyInWorkoutIds={draft.exercises.map((e) => e.exercise.id)}
          usageByExerciseId={usageByExerciseId}
          visible={exerciseModalVisible}
          title="Select exercises"
          loading={exLoading}
          exerciseOptions={exerciseOptions}
          muscleGroups={MUSCLE_GROUPS as any}
          equipmentOptions={EQUIPMENT_OPTIONS}
          initialSelectedIds={[]}
          multiSelect={true}
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
      </ScrollView>
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

    groupCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 10,
      marginTop: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    item: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
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
    chipSection: {
      marginBottom: 6,
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 10,
      columnGap: 12,
      marginBottom: 4,
    },

    empty: {
      padding: 16,
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      marginTop: 12,
    },

    modalSafeArea: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
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

    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
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
  });
