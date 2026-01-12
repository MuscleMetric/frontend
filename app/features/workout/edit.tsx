// app/features/workouts/edit.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import DraggableFlatList from "react-native-draggable-flatlist";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/authContext";
import { useAppTheme } from "../../../lib/useAppTheme";
import { ExercisePickerModal } from "../../_components/ExercisePickerModal";

/* ---------- types ---------- */

type ExerciseOption = {
  id: string;
  name: string;
  type: string | null;
  equipment: string | null;
};

type WorkoutExerciseEdit = {
  key: string; // stable key for drag list
  rowId: string; // workout_exercises.id (stable across loads)
  exerciseId: string;
  name: string;

  supersetGroup: string | null;
  supersetIndex: number | null;
  isDropset: boolean;
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

/* ---------- Superset UI helpers ---------- */

const SUPERSET_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#22c55e", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
];

const hashToIndex = (s: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
};

const supersetColorFor = (groupId: string, fallbackPrimary?: string) => {
  const c = SUPERSET_COLORS[hashToIndex(groupId, SUPERSET_COLORS.length)];
  return c || fallbackPrimary || "#3b82f6";
};

/* ---------- Display items (superset blocks drag as one) ---------- */

type DisplayItem =
  | { kind: "single"; key: string; ex: WorkoutExerciseEdit }
  | {
      kind: "superset";
      key: string;
      groupId: string;
      items: WorkoutExerciseEdit[];
    };

// make members contiguous next to their anchor (first occurrence), keep anchor position
const makeSupersetContiguous = (
  arr: WorkoutExerciseEdit[],
  groupId: string
) => {
  const anchorIdx = arr.findIndex((x) => x.supersetGroup === groupId);
  if (anchorIdx === -1) return arr;

  const members = arr.filter((x) => x.supersetGroup === groupId);
  if (members.length <= 1) return arr;

  // stable order: supersetIndex then current order
  const byIndex = [...members].sort(
    (a, b) => (a.supersetIndex ?? 0) - (b.supersetIndex ?? 0)
  );

  const anchor = arr[anchorIdx];
  const withoutAnchor = byIndex.filter((x) => x.key !== anchor.key);
  const block = [anchor, ...withoutAnchor];

  const stripped = arr.filter((x) => x.supersetGroup !== groupId);

  const next = [
    ...stripped.slice(0, anchorIdx),
    ...block,
    ...stripped.slice(anchorIdx),
  ];

  // renumber
  return next.map((x) => {
    if (x.supersetGroup !== groupId) return x;
    const i = block.findIndex((b) => b.key === x.key);
    return { ...x, supersetIndex: i };
  });
};

// build display items from contiguous supersets
const buildDisplayItems = (arr: WorkoutExerciseEdit[]): DisplayItem[] => {
  const out: DisplayItem[] = [];
  for (let i = 0; i < arr.length; i++) {
    const ex = arr[i];

    if (!ex.supersetGroup) {
      out.push({ kind: "single", key: ex.key, ex });
      continue;
    }

    const gid = ex.supersetGroup;
    const prev = i > 0 ? arr[i - 1] : null;
    const isStart = !prev || prev.supersetGroup !== gid;
    if (!isStart) continue;

    const items: WorkoutExerciseEdit[] = [];
    let j = i;
    while (j < arr.length && arr[j].supersetGroup === gid) {
      items.push(arr[j]);
      j++;
    }

    // inside block order by supersetIndex
    items.sort((a, b) => (a.supersetIndex ?? 0) - (b.supersetIndex ?? 0));

    out.push({
      kind: "superset",
      key: `ss:${gid}:${items[0]?.key ?? i}`,
      groupId: gid,
      items,
    });
  }
  return out;
};

const flattenDisplayItems = (items: DisplayItem[]) => {
  const out: WorkoutExerciseEdit[] = [];
  for (const it of items) {
    if (it.kind === "single") out.push(it.ex);
    else out.push(...it.items);
  }

  const groups = new Set(
    out.filter((x) => x.supersetGroup).map((x) => x.supersetGroup as string)
  );

  let next = out;
  for (const gid of groups) next = makeSupersetContiguous(next, gid);
  return next;
};

/* ---------- pick which superset to add to (when multiple exist) ---------- */

function SupersetPickerModal({
  visible,
  onClose,
  groups,
  onPick,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  groups: { id: string; color: string; label: string }[];
  onPick: (groupId: string) => void;
  colors: any;
}) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <View
          style={{
            width: "92%",
            maxWidth: 520,
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            Add to which superset?
          </Text>

          <View style={{ height: 10 }} />

          {groups.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => {
                onPick(g.id);
                onClose();
              }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: g.color,
                marginBottom: 10,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {g.label}
              </Text>
              <Text
                style={{ color: colors.subtle, marginTop: 2, fontSize: 12 }}
              >
                Tap to add this exercise
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={onClose}
            style={{
              marginTop: 4,
              paddingVertical: 12,
              borderRadius: 999,
              alignItems: "center",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Screen ---------- */

export default function EditWorkoutScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const params = useLocalSearchParams<{ workoutId?: string }>();
  const workoutId =
    typeof params.workoutId === "string" ? params.workoutId : undefined;

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

  // picker modal state
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exLoading, setExLoading] = useState(false);

  // filters
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(
    []
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [muscleFilterOpen, setMuscleFilterOpen] = useState(false);
  const [equipmentFilterOpen, setEquipmentFilterOpen] = useState(false);

  // usage map
  const [usageByExerciseId, setUsageByExerciseId] = useState<
    Record<string, number>
  >({});

  // superset picker state (when multiple exist)
  const [supersetPickOpen, setSupersetPickOpen] = useState(false);
  const [supersetPickTargetKey, setSupersetPickTargetKey] = useState<
    string | null
  >(null);

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
            superset_group,
            superset_index,
            is_dropset,
            exercises ( id, name )
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
            key: String(we.id), // stable for drag
            rowId: String(we.id),
            exerciseId: String(we.exercises.id),
            name: we.exercises.name ?? "Exercise",
            order_index: we.order_index ?? 0,
            supersetGroup: we.superset_group ?? null,
            supersetIndex: we.superset_index ?? null,
            isDropset: !!we.is_dropset,
          };
        })
        .filter(Boolean)
        .sort(
          (a: any, b: any) =>
            (a.order_index as number) - (b.order_index as number)
        ) as WorkoutExerciseEdit[];

      // ensure every superset is contiguous + indexed
      const groups = Array.from(
        new Set(
          exs
            .filter((x) => x.supersetGroup)
            .map((x) => x.supersetGroup as string)
        )
      );
      let next = exs;
      for (const gid of groups) next = makeSupersetContiguous(next, gid);

      setSelectedExercises(next);
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

  /* ---------- load exercise usage when picker opens ---------- */

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
          .or(`is_public.eq.true,user_id.eq.${userId}`)
          .order("name", { ascending: true })
          .limit(600);

        if (exerciseSearch.trim())
          q = q.ilike("name", `%${exerciseSearch.trim()}%`);
        if (selectedEquipment.length > 0)
          q = q.in("equipment", selectedEquipment);

        if (hasMuscleFilter) {
          const muscleIdSet = new Set<number>();
          selectedMuscleGroups.forEach((gid) => {
            const group = MUSCLE_GROUPS.find((g) => g.id === gid);
            group?.muscleIds.forEach((mid) => muscleIdSet.add(mid));
          });
          const muscleIds = Array.from(muscleIdSet);
          if (muscleIds.length > 0)
            q = q.in("exercise_muscles.muscle_id", muscleIds);
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
              name: row.name ?? "Exercise",
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

  /* ---------- confirm from ExercisePickerModal ---------- */

  const handleConfirmAddExercises = (selectedIds: string[]) => {
    if (!selectedIds.length) return;

    setSelectedExercises((prev) => {
      const existingIds = new Set(prev.map((e) => e.exerciseId));
      const now = Date.now();

      const newItems: WorkoutExerciseEdit[] = [];
      selectedIds.forEach((id, idx) => {
        if (existingIds.has(id)) return;

        const ex = exerciseOptions.find((er) => er.id === id);
        if (!ex) return;

        newItems.push({
          key: `${id}-${now}-${idx}`,
          rowId: `${id}-${now}-${idx}`, // new rows (not yet in DB)
          exerciseId: id,
          name: ex.name,
          supersetGroup: null,
          supersetIndex: null,
          isDropset: false,
        });
      });

      return [...prev, ...newItems];
    });

    setExerciseModalVisible(false);
    setExerciseSearch("");
    setSelectedMuscleGroups([]);
    setSelectedEquipment([]);
    setMuscleFilterOpen(false);
    setEquipmentFilterOpen(false);
  };

  const handleRemoveExercise = (key: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.key !== key));
  };

  /* ---------- dropset + superset actions ---------- */

  const toggleDropset = (key: string) => {
    setSelectedExercises((prev) =>
      prev.map((ex) =>
        ex.key === key ? { ...ex, isDropset: !ex.isDropset } : ex
      )
    );
  };

  const startSupersetAt = (key: string) => {
    const group = `ss_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    setSelectedExercises((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx === -1) return prev;

      const cur = prev[idx];
      if (cur.supersetGroup) return prev;

      const next = [...prev];
      next[idx] = { ...cur, supersetGroup: group, supersetIndex: 0 };
      return next;
    });
  };

  const getExistingSupersetGroups = (arr: WorkoutExerciseEdit[]) =>
    Array.from(
      new Set(
        arr.filter((x) => x.supersetGroup).map((x) => x.supersetGroup as string)
      )
    );

  const addToSuperset = (key: string, groupId: string) => {
    setSelectedExercises((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx === -1) return prev;

      const maxIndex = prev
        .filter((x) => x.supersetGroup === groupId)
        .reduce((m, x) => Math.max(m, x.supersetIndex ?? -1), -1);

      const next = [...prev];
      next[idx] = {
        ...next[idx],
        supersetGroup: groupId,
        supersetIndex: maxIndex + 1,
      };

      return makeSupersetContiguous(next, groupId);
    });
  };

  const addToPreviousSuperset = (key: string) => {
    setSelectedExercises((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx <= 0) return prev;

      let group: string | null = null;
      for (let i = idx - 1; i >= 0; i--) {
        if (prev[i].supersetGroup) {
          group = prev[i].supersetGroup;
          break;
        }
      }
      if (!group) return prev;

      const maxIndex = prev
        .filter((x) => x.supersetGroup === group)
        .reduce((m, x) => Math.max(m, x.supersetIndex ?? -1), -1);

      const next = [...prev];
      next[idx] = {
        ...next[idx],
        supersetGroup: group,
        supersetIndex: maxIndex + 1,
      };

      return makeSupersetContiguous(next, group);
    });
  };

  const removeFromSuperset = (key: string) => {
    setSelectedExercises((prev) => {
      const ex = prev.find((x) => x.key === key);
      const group = ex?.supersetGroup ?? null;

      const next = prev.map((x) =>
        x.key === key ? { ...x, supersetGroup: null, supersetIndex: null } : x
      );

      if (!group) return next;
      return makeSupersetContiguous(next, group);
    });
  };

  /* ---------- save + delete ---------- */

  const handleSave = async () => {
    if (!canSave || !userId || !workoutId) return;

    try {
      setSaving(true);

      const { error: wErr } = await supabase
        .from("workouts")
        .update({
          title: title.trim(),
          notes: notes.trim() || null,
        })
        .eq("id", workoutId)
        .eq("user_id", userId);

      if (wErr) throw wErr;

      // delete + reinsert (includes superset + dropset fields)
      const { error: delErr } = await supabase
        .from("workout_exercises")
        .delete()
        .eq("workout_id", workoutId);

      if (delErr) throw delErr;

      const inserts = selectedExercises.map((ex, idx) => ({
        workout_id: workoutId,
        exercise_id: ex.exerciseId,
        order_index: idx,
        superset_group: ex.supersetGroup,
        superset_index: ex.supersetIndex,
        is_dropset: ex.isDropset,
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
        { text: "Delete", style: "destructive", onPress: handleDelete },
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

  const displayItems = useMemo(
    () => buildDisplayItems(selectedExercises),
    [selectedExercises]
  );

  const existingGroups = useMemo(() => {
    const gids = getExistingSupersetGroups(selectedExercises);
    return gids.map((gid, idx) => ({
      id: gid,
      color: supersetColorFor(gid, colors.primary),
      label: `Superset ${idx + 1}`,
    }));
  }, [selectedExercises, colors.primary]);

  const canAddToSuperset = existingGroups.length > 0;

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
            style={[s.deleteBtn, { opacity: deleting ? 0.5 : 1 }]}
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
            <DraggableFlatList<DisplayItem>
              data={displayItems}
              keyExtractor={(item) => item.key}
              scrollEnabled={false}
              onDragEnd={({ data }) => {
                const next = flattenDisplayItems(data);
                setSelectedExercises(next);
              }}
              renderItem={({ item, drag, isActive }) => {
                if (item.kind === "single") {
                  return (
                    <ExerciseRow
                      ex={item.ex}
                      drag={drag}
                      isActive={isActive}
                      outlineColor={null}
                      isSuperset={false}
                      canAddToSuperset={canAddToSuperset}
                      onStartSuperset={startSupersetAt}
                      onAddToSuperset={(k) => {
                        // only show picker if multiple, otherwise auto add to previous
                        if (existingGroups.length <= 1) {
                          addToPreviousSuperset(k);
                        } else {
                          setSupersetPickTargetKey(k);
                          setSupersetPickOpen(true);
                        }
                      }}
                      onRemoveFromSuperset={removeFromSuperset}
                      onToggleDropset={toggleDropset}
                      onRemove={handleRemoveExercise}
                    />
                  );
                }

                const outline = supersetColorFor(item.groupId, colors.primary);

                return (
                  <View style={{ marginTop: 8 }}>
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
                          key={ex.key}
                          ex={ex}
                          drag={drag} // drag handle drags whole block
                          isActive={isActive}
                          outlineColor={outline}
                          isSuperset
                          isFirst={idx === 0}
                          isLast={idx === item.items.length - 1}
                          canAddToSuperset={canAddToSuperset}
                          onStartSuperset={startSupersetAt}
                          onAddToSuperset={(k) => {
                            // already in a superset; "add to superset" shouldn't show here
                            // but keep safe noop
                            if (existingGroups.length <= 1) {
                              addToPreviousSuperset(k);
                            } else {
                              setSupersetPickTargetKey(k);
                              setSupersetPickOpen(true);
                            }
                          }}
                          onRemoveFromSuperset={removeFromSuperset}
                          onToggleDropset={toggleDropset}
                          onRemove={handleRemoveExercise}
                        />
                      ))}
                    </View>
                  </View>
                );
              }}
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

      {/* superset picker */}
      <SupersetPickerModal
        visible={supersetPickOpen}
        onClose={() => setSupersetPickOpen(false)}
        groups={existingGroups}
        colors={colors}
        onPick={(gid) => {
          if (!supersetPickTargetKey) return;
          addToSuperset(supersetPickTargetKey, gid);
          setSupersetPickTargetKey(null);
        }}
      />

      {/* picker */}
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

  function ExerciseRow({
    ex,
    drag,
    isActive,
    outlineColor,
    isSuperset,
    isFirst,
    isLast,
    canAddToSuperset,
    onStartSuperset,
    onAddToSuperset,
    onRemoveFromSuperset,
    onToggleDropset,
    onRemove,
  }: {
    ex: WorkoutExerciseEdit;
    drag: () => void;
    isActive: boolean;
    outlineColor: string | null;
    isSuperset: boolean;
    isFirst?: boolean;
    isLast?: boolean;

    canAddToSuperset: boolean;
    onStartSuperset: (key: string) => void;
    onAddToSuperset: (key: string) => void;
    onRemoveFromSuperset: (key: string) => void;
    onToggleDropset: (key: string) => void;
    onRemove: (key: string) => void;
  }) {
    const DROPS_ORANGE = "#f97316";

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
        {/* LEFT drag handle (with text) */}
        <Pressable onLongPress={drag} hitSlop={10} style={s.dragPill}>
          <Text style={s.dragPillIcon}>≡</Text>
          <Text style={s.dragPillText}>Drag</Text>
        </Pressable>

        {/* CONTENT */}
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.exerciseName} numberOfLines={1}>
              {ex.name}
            </Text>

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
                  style={[
                    s.badgeText,
                    { color: outlineColor ?? colors.primary },
                  ]}
                >
                  Superset
                </Text>
              </View>
            ) : null}

            {ex.isDropset ? (
              <View style={[s.badge, { borderColor: DROPS_ORANGE }]}>
                <Text style={[s.badgeText, { color: DROPS_ORANGE }]}>
                  Dropset
                </Text>
              </View>
            ) : null}
          </View>

          {/* ACTION ROW */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <Pressable
              onPress={() => onToggleDropset(ex.key)}
              style={[
                s.pillBtn,
                ex.isDropset && {
                  borderColor: DROPS_ORANGE,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text
                style={[s.pillBtnText, ex.isDropset && { color: DROPS_ORANGE }]}
              >
                {ex.isDropset ? "Dropset on" : "Dropset"}
              </Text>
            </Pressable>

            {!ex.supersetGroup ? (
              <>
                <Pressable
                  onPress={() => onStartSuperset(ex.key)}
                  style={s.pillBtn}
                >
                  <Text style={s.pillBtnText}>Start superset</Text>
                </Pressable>

                {/* only show if at least one superset exists anywhere */}
                {canAddToSuperset ? (
                  <Pressable
                    onPress={() => onAddToSuperset(ex.key)}
                    style={s.pillBtn}
                  >
                    <Text style={s.pillBtnText}>Add to superset</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Pressable
                onPress={() => onRemoveFromSuperset(ex.key)}
                style={[s.pillBtn, { borderColor: colors.border }]}
              >
                <Text style={[s.pillBtnText, { color: colors.subtle }]}>
                  Remove from superset
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* RIGHT remove */}
        <Pressable onPress={() => onRemove(ex.key)} hitSlop={10}>
          <Text style={s.remove}>Remove</Text>
        </Pressable>
      </View>
    );
  }
}

/* ---------- styles ---------- */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    addExerciseText: { color: colors.primary, fontWeight: "700", fontSize: 12 },

    exerciseRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8, // was 10
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 8,
      backgroundColor: colors.surface,
      gap: 10,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "nowrap",
    },

    exerciseName: {
      color: colors.text,
      fontWeight: "700",
      flexShrink: 1, // ✅ allows badges to sit inline
      minWidth: 0, // ✅ important for iOS text truncation
    },

    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: colors.surface,
    },

    badgeText: {
      fontSize: 11,
      fontWeight: "900",
    },

    actionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8, // was 10
    },

    pillBtnCompact: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    pillBtnCompactHalf: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexGrow: 1,
      flexBasis: "48%", // ✅ two buttons on one line
    },

    remove: {
      color: colors.danger ?? "#ef4444",
      fontSize: 12,
      fontWeight: "800",
      marginLeft: 8,
    },

    dragPill: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 56,
    },
    dragPillIcon: { color: colors.subtle, fontWeight: "900", fontSize: 16 },
    dragPillText: {
      color: colors.subtle,
      fontWeight: "800",
      fontSize: 10,
      marginTop: 2,
    },

    pillBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pillBtnText: { fontSize: 12, fontWeight: "800", color: colors.text },

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
    headerTitle: { fontSize: 18, fontWeight: "900", color: colors.text },
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

    // modal styles still used by ExercisePickerModal (passed as `styles`)
    modalSafeArea: { flex: 1, paddingHorizontal: 16 },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    modalClose: { fontSize: 14, fontWeight: "700" },
    modalSearchInput: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
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

    filterHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    filterLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
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
    chipLabel: { fontSize: 12, color: colors.text, fontWeight: "600" },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 10,
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
    modalExerciseName: { fontSize: 15, fontWeight: "700", color: colors.text },
    modalExerciseMeta: { fontSize: 12, color: colors.subtle, marginTop: 2 },
    modalDoneBtn: {
      marginTop: 4,
      marginBottom: 12,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
  });
