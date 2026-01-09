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
import { supabase } from "../../../../../lib/supabase";
import { useAuth } from "../../../../../lib/authContext";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { ExercisePickerModal } from "../../../../_components/ExercisePickerModal";

type ExerciseOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
};

type WorkoutExercise = {
  key: string;
  exerciseId: string;
  name: string;
  supersetGroup: string | null; // maps to workout_exercises.superset_group
  supersetIndex: number | null; // maps to workout_exercises.superset_index
  isDropset: boolean; // maps to workout_exercises.is_dropset
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

  const [pickSupersetForKey, setPickSupersetForKey] = useState<string | null>(
    null
  );
  const [supersetColorIndexByGroup, setSupersetColorIndexByGroup] = useState<
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
          supersetGroup: null,
          supersetIndex: null,
          isDropset: false,
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

  const toggleDropset = (key: string) => {
    setSelectedExercises((prev) =>
      prev.map((ex) =>
        ex.key === key ? { ...ex, isDropset: !ex.isDropset } : ex
      )
    );
  };

  // create a new superset block starting at this exercise
  const startSupersetAt = (key: string) => {
    const group = `ss_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    setSupersetColorIndexByGroup((prev) => {
      // choose next unused colour index (cycles)
      const used = new Set(Object.values(prev));
      let nextIdx = 0;
      while (used.has(nextIdx)) nextIdx++;
      return { ...prev, [group]: nextIdx % SUPERSET_COLORS.length };
    });

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

  const cleanupSupersetColors = (arr: WorkoutExercise[]) => {
    const aliveGroups = new Set(
      arr.filter((x) => x.supersetGroup).map((x) => x.supersetGroup as string)
    );
    setSupersetColorIndexByGroup((prev) => {
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([gid, idx]) => {
        if (aliveGroups.has(gid)) next[gid] = idx;
      });
      return next;
    });
  };

  // add this exercise into the nearest superset block ABOVE it
  const addToPreviousSuperset = (key: string) => {
    setSelectedExercises((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx <= 0) return prev;

      // find nearest superset group above
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

      // snap together next to the anchor
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

      const normalized = group ? makeSupersetContiguous(next, group) : next;

      // defer cleanup after state update
      queueMicrotask(() => cleanupSupersetColors(normalized));

      return normalized;
    });
  };

  const normalizeSupersetIndexes = (arr: WorkoutExercise[]) => {
    const groupToItems = new Map<string, WorkoutExercise[]>();
    arr.forEach((ex) => {
      if (!ex.supersetGroup) return;
      const list = groupToItems.get(ex.supersetGroup) ?? [];
      list.push(ex);
      groupToItems.set(ex.supersetGroup, list);
    });

    const next = arr.map((ex) => ({ ...ex }));
    for (const [group, items] of groupToItems.entries()) {
      // in current array order
      const keysInOrder = items.map((x) => x.key);
      keysInOrder.forEach((k, i) => {
        const idx = next.findIndex((x) => x.key === k);
        if (idx !== -1) next[idx].supersetIndex = i;
      });
    }
    return next;
  };

  type DisplayItem =
    | { kind: "single"; key: string; ex: WorkoutExercise }
    | {
        kind: "superset";
        key: string;
        groupId: string;
        items: WorkoutExercise[];
      };

  const DROPS_ORANGE = colors.text ?? "#ffedd5";
  const DROPS_ORANGE_BG = "#f97316";

  // deterministic palette for supersets (different colour per group)
  // (keep these stable so a group always looks the same)
  const SUPERSET_COLORS = [
    colors.primary ?? "#3b82f6",
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

  const supersetColorFor = (groupId: string) => {
    const idx = supersetColorIndexByGroup[groupId];
    const safeIdx = typeof idx === "number" ? idx : 0;
    return SUPERSET_COLORS[safeIdx % SUPERSET_COLORS.length];
  };

  // Keep all exercises in the same superset next to the anchor.
  // Anchor = the first item in the list with that supersetGroup (keeps its position).
  const makeSupersetContiguous = (arr: WorkoutExercise[], groupId: string) => {
    const anchorIdx = arr.findIndex((x) => x.supersetGroup === groupId);
    if (anchorIdx === -1) return arr;

    const members = arr.filter((x) => x.supersetGroup === groupId);
    if (members.length <= 1) return arr;

    // stable order inside superset: supersetIndex if present, else existing order
    const byIndex = [...members].sort(
      (a, b) => (a.supersetIndex ?? 0) - (b.supersetIndex ?? 0)
    );

    // ensure anchor is first in the block
    const anchor = arr[anchorIdx];
    const withoutAnchor = byIndex.filter((x) => x.key !== anchor.key);
    const block = [anchor, ...withoutAnchor];

    // remove all members
    const stripped = arr.filter((x) => x.supersetGroup !== groupId);

    // insert block at anchor's original position
    const next = [
      ...stripped.slice(0, anchorIdx),
      ...block,
      ...stripped.slice(anchorIdx),
    ];

    // normalize supersetIndex sequentially
    return next.map((x) => {
      if (x.supersetGroup !== groupId) return x;
      const i = block.findIndex((b) => b.key === x.key);
      return { ...x, supersetIndex: i };
    });
  };

  // Build the draggable list as "display items" (singles + superset blocks).
  // Assumes supersets are already contiguous.
  const buildDisplayItems = (arr: WorkoutExercise[]): DisplayItem[] => {
    const out: DisplayItem[] = [];
    for (let i = 0; i < arr.length; i++) {
      const ex = arr[i];
      if (!ex.supersetGroup) {
        out.push({ kind: "single", key: ex.key, ex });
        continue;
      }

      // start of a superset block?
      const groupId = ex.supersetGroup;
      const prev = i > 0 ? arr[i - 1] : null;
      const isStart = !prev || prev.supersetGroup !== groupId;

      if (!isStart) continue;

      // collect contiguous members
      const items: WorkoutExercise[] = [];
      let j = i;
      while (j < arr.length && arr[j].supersetGroup === groupId) {
        items.push(arr[j]);
        j++;
      }

      out.push({
        kind: "superset",
        key: `ss:${groupId}:${ex.key}`,
        groupId,
        items,
      });
    }
    return out;
  };

  // Flatten display items back into exercises (used after drag end)
  const flattenDisplayItems = (items: DisplayItem[]): WorkoutExercise[] => {
    const out: WorkoutExercise[] = [];
    for (const it of items) {
      if (it.kind === "single") out.push(it.ex);
      else out.push(...it.items);
    }

    // normalize all superset indexes across all groups in the final order
    const groups = new Set(
      out.filter((x) => x.supersetGroup).map((x) => x.supersetGroup as string)
    );
    let next = out;
    for (const gid of groups) next = makeSupersetContiguous(next, gid);
    return next;
  };

  const displayItems = useMemo(
    () => buildDisplayItems(selectedExercises),
    [selectedExercises]
  );

  const availableSupersetGroups = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    selectedExercises.forEach((ex) => {
      if (!ex.supersetGroup) return;
      if (seen.has(ex.supersetGroup)) return;
      seen.add(ex.supersetGroup);
      ordered.push(ex.supersetGroup);
    });
    return ordered;
  }, [selectedExercises]);

  const addToSpecificSuperset = (key: string, group: string) => {
    setSelectedExercises((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx === -1) return prev;

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
        superset_group: ex.supersetGroup,
        superset_index: ex.supersetIndex,
        is_dropset: ex.isDropset,
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
                    />
                  );
                }

                const outline = supersetColorFor(item.groupId);

                return (
                  <View style={{ marginTop: 8 }}>
                    {/* one outline around the entire superset block */}
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
                          drag={drag} // drag handle drags the whole block
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

      {/* Choose superset modal */}
      {pickSupersetForKey ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: colors.card,
              borderRadius: 16,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              padding: 14,
            }}
          >
            <Text
              style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}
            >
              Add to which superset?
            </Text>
            <Text style={{ color: colors.subtle, marginTop: 6, fontSize: 12 }}>
              Pick the superset block you want this exercise to join.
            </Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {availableSupersetGroups.map((gid, i) => {
                const c = supersetColorFor(gid);
                return (
                  <Pressable
                    key={gid}
                    onPress={() => {
                      addToSpecificSuperset(pickSupersetForKey, gid);
                      setPickSupersetForKey(null);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: c,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      Superset {i + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setPickSupersetForKey(null)}
              style={{
                marginTop: 12,
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: "center",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.subtle, fontWeight: "800" }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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

  function ExerciseRow({
    ex,
    drag,
    isActive,
    outlineColor,
    isSuperset,
    isFirst,
    isLast,
  }: {
    ex: WorkoutExercise;
    drag: () => void;
    isActive: boolean;
    outlineColor: string | null;
    isSuperset: boolean;
    isFirst?: boolean;
    isLast?: boolean;
  }) {
    return (
      <View
        style={[
          s.exerciseRow,
          // inside a superset block: remove spacing between rows
          isSuperset && { marginTop: 0, borderWidth: 0, borderRadius: 0 },
          // keep corners nice inside the outer border
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
        <Pressable
          onLongPress={drag}
          hitSlop={10}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ color: colors.subtle, fontWeight: "900", fontSize: 16 }}
          >
            ≡
          </Text>
          <Text
            style={{
              color: colors.subtle,
              fontWeight: "800",
              fontSize: 10,
              marginTop: 2,
            }}
          >
            Drag
          </Text>
        </Pressable>

        {/* CONTENT */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Text style={s.exerciseName}>{ex.name}</Text>

            {/* Superset badge */}
            {ex.supersetGroup ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: outlineColor ?? colors.primary,
                  backgroundColor: colors.surface,
                }}
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

            {/* Dropset badge (ORANGE) */}
            {ex.isDropset ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: DROPS_ORANGE,
                  backgroundColor: DROPS_ORANGE_BG,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "900",
                    color: DROPS_ORANGE,
                  }}
                >
                  Dropset
                </Text>
              </View>
            ) : null}
          </View>

          {/* BUTTON ROW */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <Pressable
              onPress={() => toggleDropset(ex.key)}
              style={[
                s.pillBtn,
                ex.isDropset && {
                  borderColor: DROPS_ORANGE,
                  backgroundColor: DROPS_ORANGE_BG,
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
                  onPress={() => startSupersetAt(ex.key)}
                  style={s.pillBtn}
                >
                  <Text style={s.pillBtnText}>Start superset</Text>
                </Pressable>

                {availableSupersetGroups.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      if (availableSupersetGroups.length === 1) {
                        addToSpecificSuperset(
                          ex.key,
                          availableSupersetGroups[0]
                        );
                      } else {
                        setPickSupersetForKey(ex.key); // open picker modal
                      }
                    }}
                    style={s.pillBtn}
                  >
                    <Text style={s.pillBtnText}>Add to superset</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Pressable
                onPress={() => removeFromSuperset(ex.key)}
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
        <Pressable onPress={() => handleRemoveExercise(ex.key)} hitSlop={10}>
          <Text style={s.remove}>Remove</Text>
        </Pressable>
      </View>
    );
  }
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
  });
