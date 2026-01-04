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
  Modal,
  FlatList,
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

/* ---------- types ---------- */

type PlanExerciseRow = WorkoutExercise;

type DisplayItem =
  | { kind: "single"; key: string; ex: PlanExerciseRow }
  | {
      kind: "superset";
      key: string;
      groupId: string;
      items: PlanExerciseRow[];
    };

type ExerciseOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
};

type WorkoutPickRow = {
  id: string;
  title: string;
  updated_at: string | null;
  created_at: string | null;
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

function normalizeExerciseType(raw: string | null): ExerciseRow["type"] {
  if (raw === "strength" || raw === "cardio" || raw === "mobility") return raw;
  return null;
}

function safeInt(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function safeNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  /* ---------- guards ---------- */

  useEffect(() => {
    if (!Number.isFinite(index) || !workouts?.[index]) {
      router.replace("/features/plans/create/planInfo");
    }
  }, [index, workouts]);

  const invalid = !Number.isFinite(index) || !draft;
  if (invalid) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  /* ---------- local UI state ---------- */

  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);

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

  // Clone existing workout modal
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneSearch, setCloneSearch] = useState("");
  const [workoutChoices, setWorkoutChoices] = useState<WorkoutPickRow[]>([]);

  // Superset picker modal (when multiple existing groups)
  const [pickSupersetForExerciseId, setPickSupersetForExerciseId] = useState<
    string | null
  >(null);

  /* ---------- helpers ---------- */

  const updateExercise = useCallback(
    (exerciseId: string, patch: Partial<PlanExerciseRow>) => {
      if (!draft) return;
      const updated = exercises.map((ex) =>
        ex.exercise.id === exerciseId ? { ...ex, ...patch } : ex
      );
      const reindexed = updated.map((e, i) => ({ ...e, order_index: i }));
      setWorkout(index, { ...draft, exercises: reindexed });
    },
    [draft, exercises, index, setWorkout]
  );

  const removeExercise = useCallback(
    (exerciseId: string) => {
      if (!draft) return;
      const updated = exercises.filter((ex) => ex.exercise.id !== exerciseId);
      const reindexed = updated.map((e, i) => ({ ...e, order_index: i }));
      setWorkout(index, { ...draft, exercises: reindexed });
      if (openExerciseId === exerciseId) setOpenExerciseId(null);
    },
    [draft, exercises, index, setWorkout, openExerciseId]
  );

  const toggleDropset = useCallback(
    (exerciseId: string) => {
      const ex = exercises.find((x) => x.exercise.id === exerciseId);
      if (!ex) return;
      updateExercise(exerciseId, { isDropset: !ex.isDropset });
    },
    [exercises, updateExercise]
  );

  /* ---------- Supersets (same UX as loose workout) ---------- */

  const SUPERSET_COLORS = [
    colors.primary ?? "#3b82f6",
    "#8b5cf6",
    "#14b8a6",
    "#22c55e",
    "#f59e0b",
    "#ec4899",
    "#06b6d4",
  ];

  const supersetGroups = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ex of exercises) {
      if (!ex.supersetGroup) continue;
      if (seen.has(ex.supersetGroup)) continue;
      seen.add(ex.supersetGroup);
      out.push(ex.supersetGroup);
    }
    return out;
  }, [exercises]);

  const supersetColorForGroup = useCallback(
    (groupId: string) => {
      const idx = supersetGroups.indexOf(groupId);
      const safeIdx = idx >= 0 ? idx : 0;
      return SUPERSET_COLORS[safeIdx % SUPERSET_COLORS.length];
    },
    [supersetGroups, SUPERSET_COLORS]
  );

  // Keep all exercises of a group contiguous, anchored at first occurrence
  const makeSupersetContiguous = useCallback(
    (arr: PlanExerciseRow[], groupId: string) => {
      const anchorIdx = arr.findIndex((x) => x.supersetGroup === groupId);
      if (anchorIdx === -1) return arr;

      const members = arr.filter((x) => x.supersetGroup === groupId);
      if (members.length <= 1) return arr;

      const anchor = arr[anchorIdx];
      const withoutAnchor = members.filter(
        (x) => x.exercise.id !== anchor.exercise.id
      );
      const block = [anchor, ...withoutAnchor];

      const stripped = arr.filter((x) => x.supersetGroup !== groupId);

      const next = [
        ...stripped.slice(0, anchorIdx),
        ...block,
        ...stripped.slice(anchorIdx),
      ];

      return next;
    },
    []
  );

  const startSupersetAt = useCallback(
    (exerciseId: string) => {
      if (!draft) return;
      const ex = exercises.find((x) => x.exercise.id === exerciseId);
      if (!ex || ex.supersetGroup) return;

      const groupId = `ss-${nanoid(6)}`;
      const updated = exercises.map((x) =>
        x.exercise.id === exerciseId ? { ...x, supersetGroup: groupId } : x
      );

      const reindexed = updated.map((e, i) => ({ ...e, order_index: i }));
      setWorkout(index, { ...draft, exercises: reindexed });
    },
    [draft, exercises, index, setWorkout]
  );

  const addToSuperset = useCallback(
    (exerciseId: string, groupId: string) => {
      if (!draft) return;

      const updated = exercises.map((x) =>
        x.exercise.id === exerciseId ? { ...x, supersetGroup: groupId } : x
      );

      // snap into block
      const snapped = makeSupersetContiguous(updated, groupId);

      const reindexed = snapped.map((e, i) => ({ ...e, order_index: i }));
      setWorkout(index, { ...draft, exercises: reindexed });
    },
    [draft, exercises, index, setWorkout, makeSupersetContiguous]
  );

  const removeFromSuperset = useCallback(
    (exerciseId: string) => {
      if (!draft) return;
      const ex = exercises.find((x) => x.exercise.id === exerciseId);
      const groupId = ex?.supersetGroup ?? null;

      const updated = exercises.map((x) =>
        x.exercise.id === exerciseId ? { ...x, supersetGroup: null } : x
      );

      const snapped = groupId
        ? makeSupersetContiguous(updated, groupId)
        : updated;
      const reindexed = snapped.map((e, i) => ({ ...e, order_index: i }));
      setWorkout(index, { ...draft, exercises: reindexed });
    },
    [draft, exercises, index, setWorkout, makeSupersetContiguous]
  );

  /* ---------- display items (singles + superset blocks) ---------- */

  const buildDisplayItems = useCallback(
    (arr: PlanExerciseRow[]): DisplayItem[] => {
      const out: DisplayItem[] = [];
      for (let i = 0; i < arr.length; i++) {
        const ex = arr[i];
        if (!ex.supersetGroup) {
          out.push({
            kind: "single",
            key: `single:${ex.exercise.id}:${i}`,
            ex,
          });
          continue;
        }

        const groupId = ex.supersetGroup;
        const prev = i > 0 ? arr[i - 1] : null;
        const isStart = !prev || prev.supersetGroup !== groupId;
        if (!isStart) continue;

        const items: PlanExerciseRow[] = [];
        let j = i;
        while (j < arr.length && arr[j].supersetGroup === groupId) {
          items.push(arr[j]);
          j++;
        }

        out.push({
          kind: "superset",
          key: `ss:${groupId}:${i}`,
          groupId,
          items,
        });
      }
      return out;
    },
    []
  );

  const flattenDisplayItems = useCallback(
    (items: DisplayItem[]): PlanExerciseRow[] => {
      const out: PlanExerciseRow[] = [];
      for (const it of items) {
        if (it.kind === "single") out.push(it.ex);
        else out.push(...it.items);
      }

      // enforce contiguity for any group that exists
      const groups = Array.from(
        new Set(out.map((x) => x.supersetGroup).filter(Boolean) as string[])
      );
      let next = out;
      for (const gid of groups) next = makeSupersetContiguous(next, gid);
      return next.map((e, i) => ({ ...e, order_index: i }));
    },
    [makeSupersetContiguous]
  );

  const displayItems = useMemo(
    () => buildDisplayItems(exercises),
    [exercises, buildDisplayItems]
  );

  /* ---------- drag handler ---------- */

  const handleDragEnd = useCallback(
    ({ data }: { data: DisplayItem[] }) => {
      if (!draft) return;
      const flattened = flattenDisplayItems(data);
      setWorkout(index, { ...draft, exercises: flattened });
    },
    [draft, index, setWorkout, flattenDisplayItems]
  );

  /* ---------- exercise usage (for picker) ---------- */

  useEffect(() => {
    let alive = true;
    if (!exerciseModalVisible || !userId) return;

    (async () => {
      const { data, error } = await supabase
        .from("exercise_usage")
        .select("exercise_id,sessions_count")
        .eq("user_id", userId);

      if (error) {
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

  /* ---------- picker filters ---------- */

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

  /* ---------- load picker options ---------- */

  useEffect(() => {
    let alive = true;
    if (!exerciseModalVisible || !userId) return;

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
    userId,
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
        order_index: 0,
        supersetGroup: null,
        isDropset: false,
        target_sets: null,
        target_reps: null,
        target_weight: null,
        target_time_seconds: null,
        target_distance: null,
        notes: null,
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

    setExerciseModalVisible(false);
    setExerciseSearch("");
    setSelectedMuscleGroups([]);
    setSelectedEquipment([]);
    setMuscleFilterOpen(false);
    setEquipmentFilterOpen(false);
  };

  /* ---------- clone existing workout ---------- */

  const loadWorkoutChoices = useCallback(async () => {
    if (!userId) return;
    setCloneLoading(true);
    try {
      let q = supabase
        .from("workouts")
        .select("id,title,updated_at,created_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(60);

      if (cloneSearch.trim()) {
        q = q.ilike("title", `%${cloneSearch.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      setWorkoutChoices((data ?? []) as WorkoutPickRow[]);
    } catch (e) {
      console.warn("load workouts for clone error", e);
      setWorkoutChoices([]);
    } finally {
      setCloneLoading(false);
    }
  }, [userId, cloneSearch]);

  useEffect(() => {
    if (!cloneOpen) return;
    loadWorkoutChoices();
  }, [cloneOpen, loadWorkoutChoices]);

  const applyClonedWorkout = useCallback(
    async (workoutId: string) => {
      if (!draft) return;

      try {
        setCloneLoading(true);

        // load workout core
        const { data: wRow, error: wErr } = await supabase
          .from("workouts")
          .select("title,notes")
          .eq("id", workoutId)
          .maybeSingle();

        if (wErr) throw wErr;

        // load workout exercises (+ exercise name/type)
        const { data: weRows, error: weErr } = await supabase
          .from("workout_exercises")
          .select(
            `
            exercise_id,
            order_index,
            target_sets,
            target_reps,
            target_weight,
            target_time_seconds,
            target_distance,
            notes,
            superset_group,
            is_dropset,
            exercises:exercise_id ( id, name, type )
          `
          )
          .eq("workout_id", workoutId)
          .eq("is_archived", false)
          .order("order_index", { ascending: true });

        if (weErr) throw weErr;

        const mapped: PlanExerciseRow[] = (weRows ?? []).map(
          (r: any, i: number) => {
            const ex = r.exercises;
            return {
              exercise: {
                id: r.exercise_id,
                name: ex?.name ?? "Exercise",
                type: normalizeExerciseType(ex?.type ?? null),
              },
              order_index: i,
              supersetGroup: r.superset_group ?? null,
              isDropset: !!r.is_dropset,
              target_sets: r.target_sets ?? null,
              target_reps: r.target_reps ?? null,
              target_weight: r.target_weight ?? null,
              target_time_seconds: r.target_time_seconds ?? null,
              target_distance: r.target_distance ?? null,
              notes: r.notes ?? null,
            };
          }
        );

        // enforce contiguity on any imported groups
        const groups = Array.from(
          new Set(
            mapped.map((x) => x.supersetGroup).filter(Boolean) as string[]
          )
        );
        let next = mapped;
        for (const gid of groups) next = makeSupersetContiguous(next, gid);
        next = next.map((e, i) => ({ ...e, order_index: i }));

        setWorkout(index, {
          ...draft,
          title: (wRow?.title ?? draft.title) || draft.title,
          notes: wRow?.notes ?? draft.notes ?? "",
          exercises: next,
        });

        setCloneOpen(false);
        setOpenExerciseId(null);
      } catch (e) {
        console.warn("apply cloned workout error", e);
        Alert.alert("Could not use workout", "Please try again.");
      } finally {
        setCloneLoading(false);
      }
    },
    [draft, index, setWorkout, makeSupersetContiguous]
  );

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

  /* ---------- render ---------- */

  const canUseSupersets = exercises.length >= 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backChevron}>←</Text>
            <Text style={s.backText}>Back</Text>
          </Pressable>

          <View style={{ flex: 1 }} />

          <View style={s.stepPill}>
            <Text style={s.stepPillText}>
              Workout {index + 1}/{workoutsPerWeek}
            </Text>
          </View>
        </View>

        <Text style={s.h2}>Build this workout</Text>
        <Text style={s.subtle}>
          Supersets, dropsets, and targets will be saved into your plan.
        </Text>

        {/* Title */}
        <View style={s.card}>
          <Text style={s.label}>Title</Text>
          <TextInput
            style={s.input}
            value={draft.title}
            onChangeText={(t) => setWorkout(index, { ...draft, title: t })}
            placeholder="e.g. Push, Pull, Legs…"
            placeholderTextColor={colors.subtle}
          />

          {/* Clone workout */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable
              style={[s.pillAction, { flex: 1 }]}
              onPress={() => setCloneOpen(true)}
            >
              <Text style={s.pillActionText}>Use existing workout</Text>
            </Pressable>

            <Pressable
              style={[s.pillAction, s.pillPrimary, { flex: 1 }]}
              onPress={() => setExerciseModalVisible(true)}
            >
              <Text style={s.pillPrimaryText}>＋ Add exercises</Text>
            </Pressable>
          </View>
        </View>

        {/* Notes */}
        <View style={s.card}>
          <Text style={s.label}>Notes (optional)</Text>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
            value={draft.notes ?? ""}
            placeholder="Instructions, tempo, warm-up details…"
            placeholderTextColor={colors.subtle}
            multiline
            onChangeText={(t) => setWorkout(index, { ...draft, notes: t })}
          />
        </View>

        {/* Exercises */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.label}>Exercises</Text>
            {exercises.length > 0 ? (
              <Text style={s.countText}>{exercises.length}</Text>
            ) : null}
          </View>

          {exercises.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No exercises yet</Text>
              <Text style={s.emptyText}>
                Add exercises or clone an existing workout to get started.
              </Text>

              <Pressable
                style={[s.btn, s.primary, { marginTop: 10 }]}
                onPress={() => setExerciseModalVisible(true)}
              >
                <Text style={s.btnPrimaryText}>＋ Add exercises</Text>
              </Pressable>
            </View>
          ) : (
            <DraggableFlatList<DisplayItem>
              data={displayItems}
              keyExtractor={(item) => item.key}
              scrollEnabled={false}
              activationDistance={4}
              onDragEnd={handleDragEnd}
              renderItem={({
                item,
                drag,
                isActive,
              }: RenderItemParams<DisplayItem>) => {
                if (item.kind === "single") {
                  return (
                    <ExerciseRow
                      ex={item.ex}
                      drag={drag}
                      isActive={isActive}
                      outlineColor={null}
                      isSuperset={false}
                    />
                  );
                }

                const outline = supersetColorForGroup(item.groupId);
                return (
                  <View style={{ marginTop: 10 }}>
                    <View
                      style={{
                        borderWidth: 2,
                        borderColor: outline,
                        borderRadius: 16,
                        overflow: "hidden",
                      }}
                    >
                      {item.items.map((ex, idx) => (
                        <ExerciseRow
                          key={`${ex.exercise.id}-${idx}`}
                          ex={ex}
                          drag={drag}
                          isActive={isActive}
                          outlineColor={outline}
                          isSuperset={true}
                          isFirst={idx === 0}
                          isLast={idx === item.items.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Next */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          {index > 0 && (
            <Pressable style={s.btn} onPress={() => router.back()}>
              <Text style={s.btnText}>← Back</Text>
            </Pressable>
          )}
          <Pressable style={[s.btn, s.primary, { flex: 1 }]} onPress={next}>
            <Text style={s.btnPrimaryText}>
              {index < workoutsPerWeek - 1 ? "Next workout →" : "Next → Goals"}
            </Text>
          </Pressable>
        </View>

        {/* Superset chooser modal */}
        {pickSupersetForExerciseId ? (
          <View style={s.overlay}>
            <View style={s.overlayCard}>
              <Text style={s.overlayTitle}>Add to which superset?</Text>
              <Text style={s.overlaySub}>
                Pick the superset block you want this exercise to join.
              </Text>

              <View style={{ marginTop: 12, gap: 10 }}>
                {supersetGroups.map((gid, i) => {
                  const c = supersetColorForGroup(gid);
                  return (
                    <Pressable
                      key={gid}
                      onPress={() => {
                        addToSuperset(pickSupersetForExerciseId, gid);
                        setPickSupersetForExerciseId(null);
                      }}
                      style={[
                        s.supersetPickRow,
                        { borderColor: c, borderWidth: 2 },
                      ]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        Superset {i + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => setPickSupersetForExerciseId(null)}
                style={s.overlayCancel}
              >
                <Text style={s.overlayCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Clone workout modal */}
        <Modal visible={cloneOpen} transparent animationType="slide">
          <View style={s.modalScrim}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Use existing workout</Text>
                <Pressable onPress={() => setCloneOpen(false)}>
                  <Text style={[s.btnText, { color: colors.primary }]}>
                    Close
                  </Text>
                </Pressable>
              </View>

              <TextInput
                style={[s.input, { marginBottom: 10 }]}
                value={cloneSearch}
                onChangeText={setCloneSearch}
                placeholder="Search workouts…"
                placeholderTextColor={colors.subtle}
                onSubmitEditing={loadWorkoutChoices}
                returnKeyType="search"
              />

              {cloneLoading ? (
                <View style={{ paddingVertical: 18, alignItems: "center" }}>
                  <ActivityIndicator />
                  <Text style={[s.subtle, { marginTop: 8 }]}>Loading…</Text>
                </View>
              ) : (
                <FlatList
                  data={workoutChoices}
                  keyExtractor={(x) => x.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 10 }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={s.cloneRow}
                      onPress={() => applyClonedWorkout(item.id)}
                    >
                      <Text style={s.cloneTitle} numberOfLines={1}>
                        {item.title || "Untitled workout"}
                      </Text>
                      <Text style={s.cloneMeta} numberOfLines={1}>
                        {item.updated_at
                          ? `Updated ${new Date(
                              item.updated_at
                            ).toDateString()}`
                          : item.created_at
                          ? `Created ${new Date(
                              item.created_at
                            ).toDateString()}`
                          : ""}
                      </Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <View style={{ paddingVertical: 14 }}>
                      <Text style={s.subtle}>No workouts found.</Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
      {/* Exercise picker */}
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
    </SafeAreaView>
  );

  /* ---------- row component ---------- */

  function ExerciseRow({
    ex,
    drag,
    isActive,
    outlineColor,
    isSuperset,
    isFirst,
    isLast,
  }: {
    ex: PlanExerciseRow;
    drag: () => void;
    isActive: boolean;
    outlineColor: string | null;
    isSuperset: boolean;
    isFirst?: boolean;
    isLast?: boolean;
  }) {
    const isOpen = openExerciseId === ex.exercise.id;
    const type = ex.exercise.type;

    const dropsOn = !!ex.isDropset;

    const showStrength = type === "strength" || type === null;
    const showCardio = type === "cardio";
    const showMobility = type === "mobility";

    return (
      <View
        style={[
          s.exerciseRow,
          isSuperset && { marginTop: 0, borderWidth: 0, borderRadius: 0 },
          isSuperset &&
            isFirst && { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
          isSuperset &&
            isLast && {
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
            },
          isActive && { opacity: 0.85 },
        ]}
      >
        {/* Drag */}
        <Pressable onLongPress={drag} hitSlop={10} style={s.dragHandle}>
          <Text style={s.dragIcon}>≡</Text>
          <Text style={s.dragText}>Drag</Text>
        </Pressable>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() =>
              setOpenExerciseId((cur) =>
                cur === ex.exercise.id ? null : ex.exercise.id
              )
            }
            style={{ paddingRight: 6 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Text style={s.exerciseName}>{ex.exercise.name}</Text>

              {ex.supersetGroup ? (
                <View
                  style={[
                    s.badge,
                    {
                      borderColor: outlineColor ?? colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "900",
                      color: outlineColor ?? colors.primary,
                    }}
                  >
                    Superset
                  </Text>
                </View>
              ) : null}

              {dropsOn ? (
                <View style={[s.badge, s.badgeDropset]}>
                  <Text style={s.badgeDropsetText}>Dropset</Text>
                </View>
              ) : null}
            </View>

            <Text style={s.exerciseMeta}>
              {type ? type.toUpperCase() : "STRENGTH"} • Tap to{" "}
              {isOpen ? "collapse" : "edit targets"}
            </Text>
          </Pressable>

          {/* Actions */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <Pressable
              onPress={() => toggleDropset(ex.exercise.id)}
              style={[s.pillBtn, dropsOn && s.pillDropsetOn]}
            >
              <Text style={[s.pillBtnText, dropsOn && s.pillDropsetText]}>
                {dropsOn ? "Dropset on" : "Dropset"}
              </Text>
            </Pressable>

            {!ex.supersetGroup ? (
              <>
                <Pressable
                  onPress={() => startSupersetAt(ex.exercise.id)}
                  style={[s.pillBtn, !canUseSupersets && { opacity: 0.5 }]}
                  disabled={!canUseSupersets}
                >
                  <Text style={s.pillBtnText}>Start superset</Text>
                </Pressable>

                {supersetGroups.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      if (supersetGroups.length === 1) {
                        addToSuperset(ex.exercise.id, supersetGroups[0]);
                      } else {
                        setPickSupersetForExerciseId(ex.exercise.id);
                      }
                    }}
                    style={[s.pillBtn, !canUseSupersets && { opacity: 0.5 }]}
                    disabled={!canUseSupersets}
                  >
                    <Text style={s.pillBtnText}>Add to superset</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Pressable
                onPress={() => removeFromSuperset(ex.exercise.id)}
                style={s.pillBtn}
              >
                <Text style={[s.pillBtnText, { color: colors.subtle }]}>
                  Remove from superset
                </Text>
              </Pressable>
            )}
          </View>

          {/* Targets panel */}
          {isOpen ? (
            <View style={s.targetsBox}>
              {showStrength ? (
                <View style={s.targetsGrid}>
                  <TargetField
                    label="Sets"
                    value={ex.target_sets}
                    placeholder="e.g. 3"
                    onChange={(t) =>
                      updateExercise(ex.exercise.id, {
                        target_sets: safeInt(t),
                      })
                    }
                  />
                  <TargetField
                    label="Reps"
                    value={ex.target_reps}
                    placeholder="e.g. 8"
                    onChange={(t) =>
                      updateExercise(ex.exercise.id, {
                        target_reps: safeInt(t),
                      })
                    }
                  />
                  <TargetField
                    label="Weight"
                    value={ex.target_weight}
                    placeholder="kg"
                    onChange={(t) =>
                      updateExercise(ex.exercise.id, {
                        target_weight: safeNum(t),
                      })
                    }
                  />
                </View>
              ) : null}

              {showCardio ? (
                <View style={s.targetsGrid}>
                  <TargetField
                    label="Time"
                    value={ex.target_time_seconds}
                    placeholder="seconds"
                    onChange={(t) =>
                      updateExercise(ex.exercise.id, {
                        target_time_seconds: safeInt(t),
                      })
                    }
                  />
                  <TargetField
                    label="Distance"
                    value={ex.target_distance}
                    placeholder="km"
                    onChange={(t) =>
                      updateExercise(ex.exercise.id, {
                        target_distance: safeNum(t),
                      })
                    }
                  />
                </View>
              ) : null}

              {showMobility ? (
                <View style={s.targetsGrid}>
                  <TargetField
                    label="Time"
                    value={ex.target_time_seconds}
                    placeholder="seconds"
                    onChange={(t) =>
                      updateExercise(ex.exercise.id, {
                        target_time_seconds: safeInt(t),
                      })
                    }
                  />
                </View>
              ) : null}

              <Text style={[s.labelSm, { marginTop: 10 }]}>Exercise notes</Text>
              <TextInput
                value={ex.notes ?? ""}
                onChangeText={(t) =>
                  updateExercise(ex.exercise.id, { notes: t })
                }
                placeholder="Cueing, tempo, RPE, warm-up…"
                placeholderTextColor={colors.subtle}
                style={[s.input, { marginTop: 6 }]}
                multiline
              />
            </View>
          ) : null}
        </View>

        {/* Remove */}
        <Pressable onPress={() => removeExercise(ex.exercise.id)} hitSlop={10}>
          <Text style={s.remove}>Remove</Text>
        </Pressable>
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
    return (
      <View style={{ flex: 1, minWidth: 90 }}>
        <Text style={s.labelSm}>{label}</Text>
        <TextInput
          value={typeof value === "number" ? String(value) : ""}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          keyboardType="numeric"
          style={[s.input, { marginTop: 6 }]}
        />
      </View>
    );
  }
}

/* ---------- styles ---------- */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    backChevron: { color: colors.primary, fontSize: 16, fontWeight: "900" },
    backText: { color: colors.primary, fontSize: 14, fontWeight: "800" },

    stepPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    stepPillText: { color: colors.subtle, fontWeight: "800", fontSize: 12 },

    h2: { fontSize: 20, fontWeight: "900", color: colors.text, marginTop: 6 },
    subtle: { color: colors.subtle },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    label: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 6,
    },
    labelSm: { fontSize: 12, fontWeight: "800", color: colors.text },

    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    pillAction: {
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pillActionText: { color: colors.text, fontWeight: "800" },
    pillPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "900" },

    countText: { color: colors.subtle, fontWeight: "900" },

    empty: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 10,
    },
    emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 14 },
    emptyText: { color: colors.subtle, marginTop: 4 },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: { fontWeight: "800", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "900" },

    exerciseRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 10,
      backgroundColor: colors.surface,
      gap: 10,
    },

    dragHandle: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    dragIcon: { color: colors.subtle, fontWeight: "900", fontSize: 16 },
    dragText: {
      color: colors.subtle,
      fontWeight: "900",
      fontSize: 10,
      marginTop: 2,
    },

    exerciseName: { color: colors.text, fontWeight: "800" },
    exerciseMeta: { color: colors.subtle, marginTop: 4, fontSize: 12 },

    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: colors.card,
    },

    badgeDropset: {
      borderColor: colors.text ?? "#fff",
      backgroundColor: "#f97316",
    },
    badgeDropsetText: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.text ?? "#fff",
    },

    pillDropsetOn: {
      borderColor: colors.text ?? "#fff",
      backgroundColor: "#f97316",
    },
    pillDropsetText: { color: colors.text ?? "#fff" },

    targetsBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    targetsGrid: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },

    remove: {
      color: colors.danger ?? "#ef4444",
      fontSize: 12,
      fontWeight: "900",
      marginTop: 2,
      paddingRight: 6,
    },

    overlay: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    overlayCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 14,
    },
    overlayTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
    overlaySub: { color: colors.subtle, marginTop: 6, fontSize: 12 },
    supersetPickRow: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    overlayCancel: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    overlayCancelText: { color: colors.subtle, fontWeight: "900" },

    //Modal
    modalSafeArea: {
      flex: 1,
      paddingHorizontal: 16,
    },
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

    pillBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pillBtnText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.text,
    },

    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      maxHeight: "80%",
    },

    cloneRow: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 10,
    },
    cloneTitle: { color: colors.text, fontWeight: "900" },
    cloneMeta: { color: colors.subtle, marginTop: 4, fontSize: 12 },
  });
