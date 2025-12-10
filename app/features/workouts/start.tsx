// app/features/workouts/start.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { useAppTheme } from "../../../lib/useAppTheme";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";
import {
  startLiveWorkout,
  updateLiveWorkout,
  stopLiveWorkout,
} from "../../../lib/liveWorkout";
import { setReviewPayload } from "../../../lib/sessionStore";

/* ---------- types ---------- */
type Workout = {
  id: string;
  title: string | null;
  notes: string | null;
  workout_exercises: WorkoutExercise[];
};

type Exercise = {
  id: string;
  name: string | null;
  type: string | null; // 'strength' | 'cardio' | ...
};

type WorkoutExercise = {
  id: string;
  exercise_id: string;
  order_index: number | null;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_time_seconds: number | null;
  target_distance: number | null;
  notes: string | null;
  is_dropset?: boolean | null; // db flag to allow drop mode
  superset_group?: string | null;
  superset_index?: number | null;
  exercises: Exercise | null;

  // NEW: added during this workout only (no row in workout_exercises)
  isAdHoc?: boolean;
};

export type StrengthDrop = { reps?: string; weight?: string };

export type StrengthSet = {
  reps?: string;
  weight?: string;
  drops?: StrengthDrop[]; // when exercise dropMode is true, use this array (one set with many drops)
};

export type CardioSet = { distance?: string; timeSec?: string };

type LastSetSnapshot = {
  reps: number | null;
  weight: number | null;
  distance: number | null;
  timeSec: number | null;
};

type ExerciseState =
  | {
      kind: "strength";
      sets: StrengthSet[];
      currentSet: number;
      dropMode?: boolean; // exercise-level toggle
      completed: boolean;
      notes?: string;
      open: boolean;
    }
  | {
      kind: "cardio";
      sets: CardioSet[];
      currentSet: number;
      completed: boolean;
      notes?: string;
      open: boolean;
    };

type InProgressState = {
  workoutNotes?: string;
  byWeId: Record<string, ExerciseState>;
  startedAt: number; // ms epoch
  cardioTimeBonusSec: number;
  anyCompleted: boolean;
};

type SupersetInfo = {
  byGroup: Record<string, string[]>; // groupId -> ordered WE ids
  byWeId: Record<string, { group: string; pos: number }>;
  labels: Record<string, string>; // groupId -> "A", "B", ...
};

type ExerciseOption = {
  id: string;
  name: string | null;
  type: string | null;
  equipment: string | null;
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

/* ---------- helpers ---------- */
const isCardio = (we: WorkoutExercise) =>
  (we.exercises?.type || "").toLowerCase() === "cardio";

const isStrengthState = (
  ex: ExerciseState
): ex is Extract<ExerciseState, { kind: "strength" }> => ex.kind === "strength";

const isCardioState = (
  ex: ExerciseState
): ex is Extract<ExerciseState, { kind: "cardio" }> => ex.kind === "cardio";

const formatTargetSubtitle = (we: WorkoutExercise) => {
  if (isCardio(we)) {
    const t = we.target_time_seconds
      ? `${Math.round(we.target_time_seconds / 60)} min`
      : null;
    const d = we.target_distance ? `${we.target_distance} km` : null;
    return [t, d].filter(Boolean).join(" • ") || undefined;
  }
  const s = we.target_sets ? `${we.target_sets} sets` : undefined;
  const r = we.target_reps != null ? `× ${we.target_reps}` : undefined;
  const w = we.target_weight != null ? `• ${we.target_weight}kg` : undefined;
  return [s, r, w].filter(Boolean).join(" ") || undefined;
};

function TimerText({ startedAt, color }: { startedAt: number; color: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return (
    <Text style={{ fontSize: 28, fontWeight: "900", color }}>
      {mm}:{ss}
    </Text>
  );
}

/* Excel-style A, B, ..., Z, AA, AB, ... */
function alphaLabel(n: number) {
  let s = "";
  n += 1; // 1-based
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildSupersets(workout: Workout): SupersetInfo {
  const byGroupTmp: Record<string, { id: string; pos: number }[]> = {};
  const groupOrder: string[] = []; // first-seen order across workout

  for (const we of workout.workout_exercises) {
    if (we.superset_group) {
      const gid = we.superset_group;
      if (!byGroupTmp[gid]) {
        byGroupTmp[gid] = [];
        groupOrder.push(gid); // remember first appearance order
      }
      byGroupTmp[gid].push({ id: we.id, pos: we.superset_index ?? 0 });
    }
  }

  const byGroup: Record<string, string[]> = {};
  const byWeId: SupersetInfo["byWeId"] = {};
  const labels: Record<string, string> = {};

  // assign labels A, B, C ... based on first-appearance order
  groupOrder.forEach((gid, idx) => {
    labels[gid] = alphaLabel(idx);
  });

  Object.entries(byGroupTmp).forEach(([gid, arr]) => {
    arr.sort((a, b) => a.pos - b.pos);
    byGroup[gid] = arr.map((x) => x.id);
    byGroup[gid].forEach((weId, i) => {
      byWeId[weId] = { group: gid, pos: i };
    });
  });

  return { byGroup, byWeId, labels };
}

/* ---------- main screen ---------- */
export default function StartWorkoutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  // Disable gestures + header
  useEffect(() => {
    nav.setOptions?.({ headerShown: false, gestureEnabled: false });
  }, [nav]);

  const { session } = useAuth();
  const userId = session?.user?.id || null;

  const params = useLocalSearchParams();
  const workoutId =
    typeof params.workoutId === "string" ? params.workoutId : undefined;

  const planWorkoutId =
    typeof params.planWorkoutId === "string" ? params.planWorkoutId : undefined;

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const supersets = useMemo(
    () =>
      workout
        ? buildSupersets(workout)
        : { byGroup: {}, byWeId: {}, labels: {} },
    [workout]
  );

  const [state, setState] = useState<InProgressState | null>(null);
  const [lastWorkoutNotes, setLastWorkoutNotes] = useState<string | null>(null);
  const [notesOverlayVisible, setNotesOverlayVisible] = useState(false);

  const [lastSetsByWeId, setLastSetsByWeId] = useState<
    Record<string, LastSetSnapshot[]>
  >({});

  // scrolling to open exercise
  const scrollRef = useRef<ScrollView>(null);
  const exerciseY = useRef<Record<string, number>>({});
  const scrollToExercise = (weId: string) => {
    const y = exerciseY.current[weId];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  };

  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exLoading, setExLoading] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [modalSelectedIds, setModalSelectedIds] = useState<string[]>([]);
  // NEW: muscle & equipment filter state (for chips)
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(
    []
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const [muscleFilterOpen, setMuscleFilterOpen] = useState(false);
  const [equipmentFilterOpen, setEquipmentFilterOpen] = useState(false);
  const s = styles;

  const [replaceTargetWeId, setReplaceTargetWeId] = useState<string | null>(
    null
  );
  const isReplaceMode = !!replaceTargetWeId;

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

  // Prefill muscle chips for the exercise we are replacing
  const prefillMusclesForExercise = useCallback(async (exerciseId: string) => {
    try {
      const { data, error } = await supabase
        .from("exercise_muscles")
        .select("muscle_id")
        .eq("exercise_id", exerciseId);

      if (error) {
        console.warn("prefill muscles error", error);
        return;
      }

      const muscleIds: number[] = (data ?? []).map(
        (row: any) => row.muscle_id as number
      );
      if (!muscleIds.length) {
        setSelectedMuscleGroups([]);
        setMuscleFilterOpen(false);
        return;
      }

      const groups = MUSCLE_GROUPS.filter((g) =>
        g.muscleIds.some((mid) => muscleIds.includes(mid))
      ).map((g) => g.id);

      setSelectedMuscleGroups(groups);
      setMuscleFilterOpen(groups.length > 0);
    } catch (e) {
      console.warn("prefillMusclesForExercise exception", e);
    }
  }, []);

  const openExerciseOptions = async (we: WorkoutExercise) => {
    setReplaceTargetWeId(we.id); // enter replace mode
    setModalSelectedIds([]);
    setExerciseSearch("");

    // prefill recommended muscle chips based on this exercise
    if (we.exercise_id) {
      await prefillMusclesForExercise(we.exercise_id);
    } else {
      setSelectedMuscleGroups([]);
      setMuscleFilterOpen(false);
    }

    setExerciseModalVisible(true);
  };

  // Load / filter exercises when the modal is open or filters/search change
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

  const filteredExerciseOptions = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    if (!q) return exerciseOptions;
    return exerciseOptions.filter((opt) =>
      (opt.name || "").toLowerCase().includes(q)
    );
  }, [exerciseOptions, exerciseSearch]);

  const toggleModalSelect = (id: string) => {
    setModalSelectedIds((prev) => {
      if (isReplaceMode) {
        // single-select behaviour in replace mode
        return prev[0] === id ? [] : [id];
      }
      // multi-select when adding new exercises
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  // ---------- Existing live activity effects ----------
  useEffect(() => {
    if (!workout || !state) return;

    const { currentExercise, setLabel, prevLabel } = deriveLivePayload();
    startLiveWorkout({
      startedAt: state.startedAt,
      workoutTitle: workout.title ?? "Workout",
      currentExercise,
      setLabel,
      prevLabel,
    });

    return () => {
      stopLiveWorkout();
    };
  }, [!!workout, !!state]);

  useEffect(() => {
    if (!workout || !state) return;

    const tick = setInterval(() => {
      const { currentExercise, setLabel, prevLabel } = deriveLivePayload();
      updateLiveWorkout({
        startedAt: state.startedAt,
        workoutTitle: workout.title ?? "Workout",
        currentExercise,
        setLabel,
        prevLabel,
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [workout, state?.startedAt, state?.byWeId]);

  function deriveLivePayload(): {
    currentExercise?: string;
    setLabel?: string;
    prevLabel?: string;
  } {
    if (!workout || !state) return {};

    const openWe =
      workout.workout_exercises.find((we) => state.byWeId[we.id]?.open) ??
      workout.workout_exercises.find((we) => !state.byWeId[we.id]?.completed);

    if (!openWe) return {};

    const exState = state.byWeId[openWe.id];
    if (!exState) return {};

    const currentIdx = exState.currentSet;
    let setLabel: string | undefined;
    let prevLabel: string | undefined;

    // Grab history snapshots for this WE (from last workout)
    const histArr = lastSetsByWeId[openWe.id];

    if (exState.kind === "strength") {
      setLabel = `Set ${currentIdx + 1} of ${exState.sets.length}`;

      // --- 1️⃣ FIRST SET → show history instead of current workout ---
      if (currentIdx === 0 && histArr && histArr.length > 0) {
        // pick matching index if available, else last available history set
        const histIdx = Math.min(currentIdx, histArr.length - 1);
        const snap = histArr[histIdx];
        const reps = snap.reps ?? 0;
        const weight = snap.weight ?? 0;
        prevLabel = `${reps}×${weight}kg`;
      }

      // --- 2️⃣ LATER SETS → keep existing “previous set in this workout” behavior ---
      if (currentIdx > 0) {
        const last = exState.sets[currentIdx - 1] as any;

        if ((exState as any).dropMode) {
          const drops = (last.drops ?? []) as {
            reps?: string;
            weight?: string;
          }[];
          if (drops.length) {
            const chain = drops
              .map((d) => `${d.reps || 0}×${d.weight || 0}`)
              .join(" → ");
            prevLabel = `${chain}kg`;
          }
        } else if (last.reps || last.weight) {
          prevLabel = `${last.reps || 0}×${last.weight || 0}kg`;
        }
      }
    } else {
      // CARDIO
      setLabel = `Set ${currentIdx + 1} of ${exState.sets.length}`;

      // 1️⃣ FIRST SET → use history distance/time
      if (currentIdx === 0 && histArr && histArr.length > 0) {
        const histIdx = Math.min(currentIdx, histArr.length - 1);
        const snap = histArr[histIdx];
        const dist = snap.distance ?? 0;
        const t = snap.timeSec ?? 0;
        prevLabel = `${dist} km • ${t}s`;
      }

      // 2️⃣ LATER SETS → previous set in this workout
      if (currentIdx > 0) {
        const last = exState.sets[currentIdx - 1] as any;
        if (last.distance || last.timeSec) {
          prevLabel = `${last.distance || 0} km • ${last.timeSec || 0}s`;
        }
      }
    }

    return {
      currentExercise: openWe.exercises?.name ?? "Exercise",
      setLabel,
      prevLabel,
    };
  }

  const load = useCallback(async () => {
    if (!userId || !workoutId) return;
    setLoading(true);
    try {
      let lastSetMap: Record<string, LastSetSnapshot[]> = {};

      const { data, error } = await supabase
        .from("workouts")
        .select(
          `
          id, title, notes,
          workout_exercises(
            id, exercise_id, order_index, target_sets, target_reps, target_weight, target_time_seconds, target_distance, notes, is_dropset,
            superset_group, superset_index,
            exercises ( id, name, type )
          )
        `
        )
        .eq("id", workoutId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      const w: Workout | null = data
        ? {
            id: String(data.id),
            title: data.title ?? null,
            notes: data.notes ?? null,
            workout_exercises: (data.workout_exercises ?? [])
              .map((we: any) => ({
                id: String(we.id),
                exercise_id: String(we.exercise_id),
                order_index: we.order_index ?? null,
                target_sets: we.target_sets ?? null,
                target_reps: we.target_reps ?? null,
                target_weight:
                  we.target_weight != null ? Number(we.target_weight) : null,
                target_time_seconds: we.target_time_seconds ?? null,
                target_distance:
                  we.target_distance != null
                    ? Number(we.target_distance)
                    : null,
                notes: we.notes ?? null,
                is_dropset: we.is_dropset ?? null,
                superset_group: we.superset_group ?? null,
                superset_index: we.superset_index ?? null,
                exercises: we.exercises
                  ? {
                      id: String(we.exercises.id),
                      name: we.exercises.name ?? null,
                      type: we.exercises.type ?? null,
                    }
                  : null,
              }))
              .sort(
                (a: WorkoutExercise, b: WorkoutExercise) =>
                  (a.order_index ?? 0) - (b.order_index ?? 0)
              ),
          }
        : null;

      setWorkout(w);

      // last workout notes + last set history for this workout & user
      try {
        const { data: lastHist, error: lastErr } = await supabase
          .from("workout_history")
          .select("id, notes")
          .eq("user_id", userId)
          .eq("workout_id", workoutId)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastErr && lastHist) {
          setLastWorkoutNotes(lastHist.notes ?? null);

          if (lastHist.id) {
            // NEW: match the actual schema
            const { data: lastSets, error: lastSetsErr } = await supabase
              .from("workout_set_history")
              .select(
                `
          set_number,
          reps,
          weight,
          distance,
          time_seconds,
          workout_exercise_history!inner(
            workout_exercise_id,
            workout_history_id
          )
        `
              )
              .eq("workout_exercise_history.workout_history_id", lastHist.id);

            if (!lastSetsErr && lastSets) {
              const map: Record<string, LastSetSnapshot[]> = {};

              (lastSets as any[]).forEach((row) => {
                const weh = row.workout_exercise_history;
                const weId: string | null = weh?.workout_exercise_id ?? null;
                if (!weId) return; // ad-hoc exercise with no template WE.id

                const setIndexRaw = row.set_number ?? 1;
                const setIndex = Math.max(0, Number(setIndexRaw) - 1);

                if (!map[weId]) map[weId] = [];

                map[weId][setIndex] = {
                  reps:
                    row.reps != null && !Number.isNaN(Number(row.reps))
                      ? Number(row.reps)
                      : null,
                  weight:
                    row.weight != null && !Number.isNaN(Number(row.weight))
                      ? Number(row.weight)
                      : null,
                  distance:
                    row.distance != null && !Number.isNaN(Number(row.distance))
                      ? Number(row.distance)
                      : null,
                  timeSec:
                    row.time_seconds != null &&
                    !Number.isNaN(Number(row.time_seconds))
                      ? Number(row.time_seconds)
                      : null,
                };
              });

              lastSetMap = map;
              setLastSetsByWeId(map);
            } else {
              lastSetMap = {};
              setLastSetsByWeId({});
            }
          } else {
            lastSetMap = {};
            setLastSetsByWeId({});
          }
        } else {
          setLastWorkoutNotes(null);
          lastSetMap = {};
          setLastSetsByWeId({});
        }
      } catch (e) {
        console.warn("load lastWorkoutNotes / last set history error", e);
        setLastWorkoutNotes(null);
        lastSetMap = {};
        setLastSetsByWeId({});
      }

      // initialize in-progress state (prefill from lastSetMap if available)
      if (w) {
        const byWeId: Record<string, ExerciseState> = {};

        for (const we of w.workout_exercises) {
          const histSets = lastSetMap[we.id] ?? [];

          if (isCardio(we)) {
            const sets: CardioSet[] =
              histSets.length > 0
                ? histSets.map((h) => ({
                    distance:
                      h.distance != null && !Number.isNaN(h.distance)
                        ? String(h.distance)
                        : "",
                    timeSec:
                      h.timeSec != null && !Number.isNaN(h.timeSec)
                        ? String(h.timeSec)
                        : "",
                  }))
                : [
                    {
                      distance: "",
                      timeSec: "",
                    },
                  ];

            byWeId[we.id] = {
              kind: "cardio",
              sets,
              currentSet: 0, // start on Set 1
              completed: false,
              notes: "",
              open: false,
            };
          } else {
            let sets: StrengthSet[];

            if (histSets.length > 0) {
              // Prefill one StrengthSet per historical set
              sets = histSets.map((h) => ({
                reps:
                  h.reps != null && !Number.isNaN(h.reps) ? String(h.reps) : "",
                weight:
                  h.weight != null && !Number.isNaN(h.weight)
                    ? String(h.weight)
                    : "",
                drops: [], // can't infer drops from aggregate history
              }));
            } else {
              // Fallback to target_sets / default
              sets =
                we.target_sets && we.target_sets > 0
                  ? Array.from(
                      { length: we.target_sets },
                      () =>
                        ({
                          reps: "",
                          weight: "",
                          drops: [],
                        } as StrengthSet)
                    )
                  : [{ reps: "", weight: "", drops: [] } as StrengthSet];
            }

            byWeId[we.id] = {
              kind: "strength",
              sets,
              currentSet: 0, // start on Set 1
              dropMode: false,
              completed: false,
              notes: "",
              open: false,
            };
          }
        }

        setState({
          workoutNotes: "",
          byWeId,
          cardioTimeBonusSec: 0,
          startedAt: Date.now(),
          anyCompleted: false,
        });
      } else {
        setState(null);
      }
    } catch (e) {
      console.warn("start workout load error", e);
      setWorkout(null);
      setState(null);
      setLastWorkoutNotes(null);
      setLastSetsByWeId({});
    } finally {
      setLoading(false);
    }
  }, [userId, workoutId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- Add / replace ad-hoc exercises (from exercises table) ----------
  const handleConfirmAddExercises = () => {
    if (!workout || modalSelectedIds.length === 0) {
      setExerciseModalVisible(false);
      return;
    }

    const selected = exerciseOptions.filter((opt) =>
      modalSelectedIds.includes(opt.id)
    );
    if (!selected.length) {
      setExerciseModalVisible(false);
      return;
    }

    // ---- REPLACE MODE ----
    if (replaceTargetWeId) {
      const replacement = selected[0]; // single-select in replace mode
      const targetIndex = workout.workout_exercises.findIndex(
        (we) => we.id === replaceTargetWeId
      );
      if (!replacement || targetIndex === -1) {
        // fallback: just close
        setExerciseModalVisible(false);
        setReplaceTargetWeId(null);
        return;
      }

      const type = (replacement.type || "").toLowerCase();
      const isCardioKind = type === "cardio";

      const newWeId = `adhoc-replace-${Date.now()}`;
      const baseOrder =
        workout.workout_exercises[targetIndex]?.order_index ?? targetIndex;

      const replacementWe: WorkoutExercise = {
        id: newWeId,
        exercise_id: replacement.id, // actual DB exercise id
        order_index: baseOrder,
        target_sets: isCardioKind ? null : 3,
        target_reps: isCardioKind ? null : 10,
        target_weight: null,
        target_time_seconds: isCardioKind ? 600 : null,
        target_distance: null,
        notes: null,
        is_dropset: false,
        superset_group: null,
        superset_index: null,
        exercises: {
          id: replacement.id,
          name: replacement.name ?? "Exercise",
          type: replacement.type,
        },
        isAdHoc: true,
      };

      // 1) replace in workout object
      setWorkout((prev) => {
        if (!prev) return prev;
        const arr = [...prev.workout_exercises];
        arr[targetIndex] = replacementWe;
        return { ...prev, workout_exercises: arr };
      });

      // 2) replace in in-progress state
      setState((s) => {
        if (!s) return s;
        const nextByWeId: Record<string, ExerciseState> = { ...s.byWeId };
        delete nextByWeId[replaceTargetWeId];

        // init state for new exercise
        nextByWeId[newWeId] = isCardioKind
          ? {
              kind: "cardio",
              sets: [{ distance: "", timeSec: "" }],
              currentSet: 0,
              completed: false,
              notes: "",
              open: true,
            }
          : {
              kind: "strength",
              sets: [{ reps: "", weight: "", drops: [] }],
              currentSet: 0,
              dropMode: false,
              completed: false,
              notes: "",
              open: true,
            };

        // close others
        Object.keys(nextByWeId).forEach((id) => {
          if (id !== newWeId) {
            nextByWeId[id] = { ...nextByWeId[id], open: false };
          }
        });

        return { ...s, byWeId: nextByWeId };
      });

      const scrollId = newWeId;
      requestAnimationFrame(() => scrollToExercise(scrollId));
    } else {
      // ---- ADD MODE (existing behaviour: add to end as ad-hoc) ----
      let baseOrder =
        workout.workout_exercises[workout.workout_exercises.length - 1]
          ?.order_index ?? workout.workout_exercises.length - 1;

      const added: WorkoutExercise[] = selected.map((opt, idx) => {
        const weId = `adhoc-${Date.now()}-${idx}`;
        const type = (opt.type || "").toLowerCase();
        const isCardioKind = type === "cardio";
        const order_index = (baseOrder ?? 0) + idx + 1;

        return {
          id: weId,
          exercise_id: opt.id,
          order_index,
          target_sets: isCardioKind ? null : 3,
          target_reps: isCardioKind ? null : 10,
          target_weight: null,
          target_time_seconds: isCardioKind ? 600 : null,
          target_distance: null,
          notes: null,
          is_dropset: false,
          superset_group: null,
          superset_index: null,
          exercises: {
            id: opt.id,
            name: opt.name ?? "Exercise",
            type: opt.type,
          },
          isAdHoc: true,
        };
      });

      setWorkout((prev) =>
        prev
          ? {
              ...prev,
              workout_exercises: [...prev.workout_exercises, ...added],
            }
          : prev
      );

      setState((s) => {
        if (!s) return s;
        const byWeId = { ...s.byWeId };

        for (const we of added) {
          if ((we.exercises?.type || "").toLowerCase() === "cardio") {
            byWeId[we.id] = {
              kind: "cardio",
              sets: [{ distance: "", timeSec: "" }],
              currentSet: 0,
              completed: false,
              notes: "",
              open: false,
            };
          } else {
            byWeId[we.id] = {
              kind: "strength",
              sets: [{ reps: "", weight: "", drops: [] }],
              currentSet: 0,
              dropMode: false,
              completed: false,
              notes: "",
              open: false,
            };
          }
        }

        return { ...s, byWeId };
      });

      const firstId = added[0]?.id;
      if (firstId) {
        requestAnimationFrame(() => scrollToExercise(firstId));
        setState((s) => {
          if (!s) return s;
          const nextByWe: Record<string, ExerciseState> = {};
          for (const [id, ex] of Object.entries(s.byWeId)) {
            nextByWe[id] = { ...ex, open: id === firstId };
          }
          return { ...s, byWeId: nextByWe };
        });
      }
    }

    // reset + close
    setExerciseModalVisible(false);
    setModalSelectedIds([]);
    setExerciseSearch("");
    setReplaceTargetWeId(null);
    setSelectedMuscleGroups([]);
    setSelectedEquipment([]);
    setMuscleFilterOpen(false);
    setEquipmentFilterOpen(false);
  };

  // ---------- Early loading / auth guards ----------
  if (!userId) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <Text style={{ color: colors.text }}>Please log in.</Text>
      </SafeAreaView>
    );
  }
  if (loading || !workout || !state) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const setExerciseOpen = (weId: string, open: boolean) =>
    setState((s) => {
      if (!s) return s;
      const nextByWeId: Record<string, ExerciseState> = {};
      for (const [id, ex] of Object.entries(s.byWeId)) {
        nextByWeId[id] = { ...ex, open: id === weId ? open : false };
      }
      const next = { ...s, byWeId: nextByWeId };
      if (open) {
        requestAnimationFrame(() => scrollToExercise(weId));
      }
      return next;
    });

  const updateSet = (
    weId: string,
    index: number,
    patch: Partial<StrengthSet> | Partial<CardioSet>
  ) =>
    setState((s) => {
      if (!s) return s;
      const ex = s.byWeId[weId];
      if (!ex) return s;

      if (isStrengthState(ex)) {
        const sets = ex.sets.slice();
        const cur = {
          ...(sets[index] as StrengthSet),
          ...(patch as Partial<StrengthSet>),
        };
        sets[index] = cur;
        const next: typeof ex = { ...ex, sets };
        return { ...s, byWeId: { ...s.byWeId, [weId]: next } };
      }

      if (isCardioState(ex)) {
        const sets = ex.sets.slice();
        const cur = {
          ...(sets[index] as CardioSet),
          ...(patch as Partial<CardioSet>),
        };
        sets[index] = cur as any;
        const next: typeof ex = { ...ex, sets };
        return { ...s, byWeId: { ...s.byWeId, [weId]: next } };
      }

      return s;
    });

  const addSet = (weId: string) =>
    setState((s) => {
      if (!s) return s;
      const ex = s.byWeId[weId];
      if (!ex) return s;

      if (isStrengthState(ex)) {
        const next: typeof ex = {
          ...ex,
          sets: [...ex.sets, { reps: "", weight: "", drops: [] }],
        };
        return { ...s, byWeId: { ...s.byWeId, [weId]: next } };
      }

      if (isCardioState(ex)) {
        const next: typeof ex = {
          ...ex,
          sets: [...ex.sets, { distance: "", timeSec: "" }],
        };
        return { ...s, byWeId: { ...s.byWeId, [weId]: next } };
      }

      return s;
    });

  const removeLastSet = (weId: string) =>
    setState((s) => {
      if (!s) return s;
      const ex = s.byWeId[weId];
      if (!ex || ex.sets.length <= 1) return s;

      const nextSets = ex.sets.slice(0, ex.sets.length - 1);
      const nextCurrent = Math.min(ex.currentSet, nextSets.length - 1);
      const nextEx: ExerciseState = {
        ...(ex as any),
        sets: nextSets as any,
        currentSet: nextCurrent,
      };
      return { ...s, byWeId: { ...s.byWeId, [weId]: nextEx } };
    });

  const setPrevSet = (weId: string) =>
    setState((s) => {
      if (!s) return s;
      const ex = s.byWeId[weId];
      if (!ex) return s;

      const node = supersets.byWeId[weId];
      if (node && supersets.byGroup[node.group]?.length > 1) {
        const groupIds = supersets.byGroup[node.group];
        const prevPos = (node.pos - 1 + groupIds.length) % groupIds.length;
        const prevWeId = groupIds[prevPos];
        const prevEx = s.byWeId[prevWeId];
        if (prevEx && !prevEx.completed) {
          const updatedBy: Record<string, ExerciseState> = {};
          for (const [id, val] of Object.entries(s.byWeId)) {
            if (id === prevWeId)
              updatedBy[id] = { ...val, open: true } as ExerciseState;
            else if (id === weId)
              updatedBy[id] = { ...val, open: false } as ExerciseState;
            else updatedBy[id] = val;
          }
          const updated = { ...s, byWeId: updatedBy };
          requestAnimationFrame(() => scrollToExercise(prevWeId));
          return updated;
        }
        return s;
      }

      // non-superset fallback: go to previous set index
      const i = Math.max(0, ex.currentSet - 1);
      return {
        ...s,
        byWeId: { ...s.byWeId, [weId]: { ...ex, currentSet: i } },
      };
    });

  function hasSetDataForNext(ex: ExerciseState): boolean {
    const i = ex.currentSet;

    if (ex.kind === "strength") {
      const cur = ex.sets[i] as StrengthSet;
      if ((ex as any).dropMode) {
        const drops = cur.drops ?? [];
        // at least one drop row has reps or weight
        return drops.some(
          (d) => (d.reps && d.reps !== "0") || (d.weight && d.weight !== "0")
        );
      }
      // regular: reps or weight present
      return !!(
        (cur.reps && cur.reps !== "0") ||
        (cur.weight && cur.weight !== "0")
      );
    }

    // cardio: distance or time present
    const cur = ex.sets[i] as CardioSet;
    return !!(
      (cur.distance && cur.distance !== "0") ||
      (cur.timeSec && cur.timeSec !== "0")
    );
  }

  const setNextSet = (weId: string) =>
    setState((s) => {
      if (!s) return s;
      const ex = s.byWeId[weId];
      if (!ex) return s;

      // 🚫 Block next if current set is empty
      if (!hasSetDataForNext(ex)) {
        Alert.alert(
          "Add a set",
          "Please enter reps/weight (or a drop row) before moving to the next set."
        );
        return s;
      }

      const isStrength = isStrengthState(ex);
      const isCardioT = isCardioState(ex);

      // If this WE is in a superset group, alternate to the next WE in the same group
      const node = supersets.byWeId[weId];
      if (node && supersets.byGroup[node.group]?.length > 1) {
        const groupIds = supersets.byGroup[node.group];

        let updated: InProgressState = s;

        // Advance current exercise set cursor (and prefill if needed)
        if (isStrength) {
          const _ex = updated.byWeId[weId] as Extract<
            ExerciseState,
            { kind: "strength" }
          >;
          const cur = _ex.currentSet;
          const atEndLocal = cur >= _ex.sets.length - 1;
          if (atEndLocal) {
            const prev = _ex.sets[cur] as StrengthSet;
            const nextSet: StrengthSet = {
              reps: prev.reps ?? "",
              weight: prev.weight ?? "",
              drops: (prev.drops ?? []).map((d) => ({
                reps: d.reps ?? "",
                weight: d.weight ?? "",
              })),
            };
            updated = {
              ...updated,
              byWeId: {
                ...updated.byWeId,
                [weId]: {
                  ..._ex,
                  sets: [..._ex.sets, nextSet],
                  currentSet: cur + 1,
                },
              },
            };
          } else {
            updated = {
              ...updated,
              byWeId: {
                ...updated.byWeId,
                [weId]: { ..._ex, currentSet: cur + 1 },
              },
            };
          }
        } else if (isCardioT) {
          const _ex = updated.byWeId[weId] as Extract<
            ExerciseState,
            { kind: "cardio" }
          >;
          const cur = _ex.currentSet;
          const atEndLocal = cur >= _ex.sets.length - 1;
          if (atEndLocal) {
            const prev = _ex.sets[cur];
            const nextSet: CardioSet = {
              distance: prev.distance ?? "",
              timeSec: prev.timeSec ?? "",
            };
            updated = {
              ...updated,
              byWeId: {
                ...updated.byWeId,
                [weId]: {
                  ..._ex,
                  sets: [..._ex.sets, nextSet],
                  currentSet: cur + 1,
                },
              },
            };
          } else {
            updated = {
              ...updated,
              byWeId: {
                ...updated.byWeId,
                [weId]: { ..._ex, currentSet: cur + 1 },
              },
            };
          }
        }

        // 2) Open NEXT exercise in the group (same set index)
        const curPos = node.pos;
        const nextPos = (curPos + 1) % groupIds.length;
        const nextWeId = groupIds[nextPos];

        const nextEx = updated.byWeId[nextWeId];
        if (nextEx && !nextEx.completed) {
          const updatedBy: Record<string, ExerciseState> = {};
          for (const [id, val] of Object.entries(updated.byWeId)) {
            if (id === nextWeId)
              updatedBy[id] = { ...val, open: true } as ExerciseState;
            else updatedBy[id] = { ...val, open: false } as ExerciseState;
          }
          requestAnimationFrame(() => scrollToExercise(nextWeId));
          return { ...updated, byWeId: updatedBy };
        }

        return updated;
      }

      // --- Non-superset fallback (original logic) ---
      const i = ex.currentSet;
      const atEnd = i >= ex.sets.length - 1;
      if (atEnd) {
        if (isStrength) {
          const prev = ex.sets[i] as StrengthSet;
          const nextSet: StrengthSet = {
            reps: prev.reps ?? "",
            weight: prev.weight ?? "",
            drops: (prev.drops ?? []).map((d) => ({
              reps: d.reps ?? "",
              weight: d.weight ?? "",
            })),
          };
          return {
            ...s,
            byWeId: {
              ...s.byWeId,
              [weId]: { ...ex, sets: [...ex.sets, nextSet], currentSet: i + 1 },
            },
          };
        }
        if (isCardioT) {
          const prev = ex.sets[i] as CardioSet;
          const nextSet: CardioSet = {
            distance: prev.distance ?? "",
            timeSec: prev.timeSec ?? "",
          };
          return {
            ...s,
            byWeId: {
              ...s.byWeId,
              [weId]: { ...ex, sets: [...ex.sets, nextSet], currentSet: i + 1 },
            },
          };
        }
        return s;
      }

      // just move to next existing set
      if (isStrength) {
        const prev = ex.sets[i] as StrengthSet;
        const cur = ex.sets[i + 1] as StrengthSet;
        const shouldPrefill =
          !(cur.reps || cur.weight) && !(cur.drops && cur.drops.length);
        const sets = ex.sets.slice();
        if (shouldPrefill) {
          sets[i + 1] = {
            reps: prev.reps ?? "",
            weight: prev.weight ?? "",
            drops: (prev.drops ?? []).map((d) => ({
              reps: d.reps ?? "",
              weight: d.weight ?? "",
            })),
          };
        }
        return {
          ...s,
          byWeId: { ...s.byWeId, [weId]: { ...ex, sets, currentSet: i + 1 } },
        };
      }
      if (isCardioT) {
        const prev = ex.sets[i] as CardioSet;
        const cur = ex.sets[i + 1] as CardioSet;
        const shouldPrefill = !(cur.distance || cur.timeSec);
        const sets = ex.sets.slice();
        if (shouldPrefill)
          sets[i + 1] = {
            distance: prev.distance ?? "",
            timeSec: prev.timeSec ?? "",
          };
        return {
          ...s,
          byWeId: { ...s.byWeId, [weId]: { ...ex, sets, currentSet: i + 1 } },
        };
      }
      return s;
    });

  const completeExercise = (weId: string) => {
    let openIdAfter: string | null = null;

    setState((s) => {
      if (!s || !workout) return s;
      const ex = s.byWeId[weId];
      if (!ex) return s;

      // validate
      const hasData =
        ex.kind === "strength"
          ? ex.sets.some((st) => {
              const sst = st as StrengthSet;
              if ((ex as any).dropMode) {
                const arr = sst.drops ?? [];
                return arr.some(
                  (d) =>
                    (d.reps && d.reps !== "0") || (d.weight && d.weight !== "0")
                );
              } else {
                return (
                  (sst.reps && sst.reps !== "0") ||
                  (sst.weight && sst.weight !== "0")
                );
              }
            })
          : ex.sets.some(
              (st) =>
                (st.distance && st.distance !== "0") ||
                (st.timeSec && st.timeSec !== "0")
            );

      if (!hasData) {
        Alert.alert(
          "Add a set",
          "Please enter at least one set before completing."
        );
        return s;
      }

      // cardio bonus
      let bonus = 0;
      if (ex.kind === "cardio") {
        for (const st of ex.sets) {
          const t = Number((st as CardioSet).timeSec || 0);
          if (!Number.isNaN(t)) bonus += t;
        }
      }

      let updated: InProgressState = {
        ...s,
        byWeId: {
          ...s.byWeId,
          [weId]: { ...ex, completed: true, open: false },
        },
        cardioTimeBonusSec: s.cardioTimeBonusSec + bonus,
        anyCompleted: true,
      };

      // Try to open next incomplete in the same superset group first
      const node = supersets.byWeId[weId];
      if (node) {
        const groupIds = supersets.byGroup[node.group] || [];
        for (let i = 0; i < groupIds.length; i++) {
          const candidateId = groupIds[i];
          if (candidateId === weId) continue;
          const cand = updated.byWeId[candidateId];
          if (cand && !cand.completed) {
            const updatedBy: Record<string, ExerciseState> = {};
            for (const [id, val] of Object.entries(updated.byWeId)) {
              if (id === candidateId)
                updatedBy[id] = { ...val, open: true } as ExerciseState;
              else updatedBy[id] = { ...val, open: false } as ExerciseState;
            }
            updated = { ...updated, byWeId: updatedBy };
            openIdAfter = candidateId;
            break;
          }
        }
      }

      // Fallback: open next global incomplete (your old behavior)
      if (!openIdAfter) {
        const ids = workout.workout_exercises.map((w) => w.id);
        const curIdx = ids.indexOf(weId);
        for (let i = curIdx + 1; i < ids.length; i++) {
          const nid = ids[i];
          const n = updated.byWeId[nid];
          if (n && !n.completed) {
            const updatedBy: Record<string, ExerciseState> = {};
            for (const [id, val] of Object.entries(updated.byWeId)) {
              if (id === nid)
                updatedBy[id] = { ...val, open: true } as ExerciseState;
              else updatedBy[id] = { ...val, open: false } as ExerciseState;
            }
            updated = { ...updated, byWeId: updatedBy };
            openIdAfter = nid;
            break;
          }
        }
      }

      return updated;
    });

    if (openIdAfter) {
      setTimeout(() => scrollToExercise(openIdAfter!), 60);
    }
  };

  const Header = () => (
    <View style={styles.header}>
      <Pressable
        onPress={() =>
          Alert.alert(
            "End Workout?",
            "Are you sure you want to stop? Nothing will be saved.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Discard",
                style: "destructive",
                onPress: () => {
                  stopLiveWorkout();
                  router.back();
                },
              },
            ]
          )
        }
        hitSlop={8}
        style={{ paddingHorizontal: 6, paddingVertical: 2 }}
      >
        <Text style={{ color: colors.danger, fontSize: 20, fontWeight: "800" }}>
          ✕
        </Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={styles.title} numberOfLines={2}>
          {workout.title ?? "Workout"}
        </Text>
        <Text style={styles.subtle}>In Progress</Text>
      </View>

      <View style={{ width: 88, alignItems: "flex-end" }}>
        <TimerText startedAt={state.startedAt} color={colors.text} />
      </View>
    </View>
  );

  const completedCount = workout.workout_exercises.filter(
    (we) => state.byWeId[we.id]?.completed
  ).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
        }}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
      >
        {/* Exercise Panels */}
        {workout.workout_exercises.map((we, idx) => {
          const exState = state.byWeId[we.id];
          const isOpen = exState.open;
          const subtitle = formatTargetSubtitle(we);

          const isLastSet =
            exState.currentSet >= exState.sets.length - 1 &&
            exState.sets.length > 0;

          const shouldShowComplete = isLastSet;

          const lastHistorySets = lastSetsByWeId[we.id];

          return (
            <View
              key={we.id}
              onLayout={(e) => {
                exerciseY.current[we.id] = e.nativeEvent.layout.y;
              }}
              style={[styles.bigCard, isOpen && styles.bigCardActive]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isOpen ? colors.primaryBg : colors.surface,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    marginRight: 10,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {idx + 1}
                  </Text>
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.h3}>
                    {we.exercises?.name ?? "Exercise"}
                  </Text>
                  {subtitle ? (
                    <Text style={styles.muted}>{subtitle}</Text>
                  ) : null}
                </View>

                {/* Completed / Active / Start pill (completed is tappable to re-open) */}
                {exState.completed ? (
                  <Pressable
                    onPress={() => setExerciseOpen(we.id, !isOpen)}
                    style={[
                      styles.badge,
                      {
                        borderColor: colors.successText,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.successText,
                        fontWeight: "800",
                      }}
                    >
                      {isOpen ? "Editing ✓" : "Done ✓ Edit"}
                    </Text>
                  </Pressable>
                ) : isOpen ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={[
                        styles.badge,
                        { color: colors.warnText ?? colors.text },
                      ]}
                    >
                      Active
                    </Text>

                    {/* 3-dots menu – replace this exercise */}
                    <Pressable
                      onPress={() => openExerciseOptions(we)}
                      hitSlop={8}
                      style={styles.iconButton}
                    >
                      <Text
                        style={{
                          color: colors.subtle,
                          fontSize: 18,
                          fontWeight: "900",
                        }}
                      >
                        ⋯
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setExerciseOpen(we.id, true)}
                    style={[styles.pill, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      Start
                    </Text>
                  </Pressable>
                )}

                {we.superset_group ? (
                  <Text
                    style={[
                      styles.badge,
                      {
                        alignSelf: "flex-start",
                        marginTop: 4,
                        color: colors.primaryText,
                      },
                    ]}
                  >
                    Superset {supersets.labels[we.superset_group] || "A"}
                  </Text>
                ) : null}
              </View>

              {/* Summary of completed sets */}
              {exState.completed && exState.kind === "strength" && (
                <View style={styles.completedSummaryContainer}>
                  {exState.sets.map((set, i) => {
                    const sSet = set as StrengthSet;
                    if (
                      (exState as any).dropMode &&
                      sSet.drops &&
                      sSet.drops.length
                    ) {
                      const chain = sSet.drops
                        .map((d) => `${d.reps || 0} reps × ${d.weight || 0}kg`)
                        .join(" → ");
                      return (
                        <Text key={i} style={styles.completedSummaryLine}>
                          {i + 1}. {chain}
                        </Text>
                      );
                    }
                    return (
                      <Text key={i} style={styles.completedSummaryLine}>
                        {i + 1}. {sSet.reps || 0} reps × {sSet.weight || 0}kg
                      </Text>
                    );
                  })}
                </View>
              )}

              {/* Editor when open (even if completed so user can fix mistakes) */}
              {isOpen ? (
                <View style={{ marginTop: 14 }}>
                  {/* Exercise-level Drop Set toggle (for strength) */}
                  {exState.kind === "strength" && we.is_dropset ? (
                    <View style={{ marginBottom: 8 }}>
                      <Pressable
                        onPress={() =>
                          setState((s2) => {
                            if (!s2) return s2;
                            const ex = s2.byWeId[we.id];
                            if (!ex || ex.kind !== "strength") return s2;
                            const next: Extract<
                              ExerciseState,
                              { kind: "strength" }
                            > = { ...(ex as any), dropMode: !ex.dropMode };

                            if (next.dropMode) {
                              const i = next.currentSet;
                              const set = next.sets[i];
                              if (!set.drops || set.drops.length === 0) {
                                set.drops = [
                                  {
                                    reps: set.reps || "",
                                    weight: set.weight || "",
                                  },
                                ];
                              }
                            }

                            return {
                              ...s2,
                              byWeId: { ...s2.byWeId, [we.id]: next },
                            };
                          })
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          backgroundColor: colors.surface,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: colors.border,
                          shadowColor: colors.text,
                          shadowOpacity: 0.08,
                          shadowOffset: { width: 0, height: 1 },
                          shadowRadius: 2,
                        }}
                        hitSlop={8}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: exState.dropMode
                              ? colors.primaryText
                              : colors.subtle,
                            backgroundColor: exState.dropMode
                              ? colors.primaryBg
                              : colors.background,
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: colors.text,
                            shadowOpacity: exState.dropMode ? 0.25 : 0.05,
                            shadowOffset: { width: 0, height: 1 },
                            shadowRadius: exState.dropMode ? 2 : 0,
                          }}
                        >
                          {exState.dropMode ? (
                            <Text
                              style={{
                                color: colors.primaryText,
                                fontWeight: "900",
                                fontSize: 14,
                              }}
                            >
                              ✓
                            </Text>
                          ) : null}
                        </View>

                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "700",
                            fontSize: 15,
                          }}
                        >
                          Drop set (multiple weights in one set)
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* History preview for this set */}
                  {(() => {
                    const i = exState.currentSet;
                    const histArr = lastHistorySets;

                    if (!histArr || histArr.length === 0) {
                      return (
                        <Text
                          style={[
                            styles.muted,
                            {
                              textAlign: "center",
                              marginBottom: 8,
                              fontWeight: "600",
                            },
                          ]}
                        >
                          No previous sets recorded for this exercise
                        </Text>
                      );
                    }

                    const snap = histArr[i];
                    if (!snap) return null;

                    if (exState.kind === "strength") {
                      const reps = snap.reps ?? 0;
                      const weight = snap.weight ?? 0;
                      return (
                        <Text
                          style={[
                            styles.muted,
                            {
                              textAlign: "center",
                              marginBottom: 8,
                              fontWeight: "600",
                            },
                          ]}
                        >
                          Last time (Set {i + 1}): {reps} × {weight}kg
                        </Text>
                      );
                    } else {
                      const dist = snap.distance ?? 0;
                      const t = snap.timeSec ?? 0;
                      return (
                        <Text
                          style={[
                            styles.muted,
                            {
                              textAlign: "center",
                              marginBottom: 8,
                              fontWeight: "600",
                            },
                          ]}
                        >
                          Last time (Set {i + 1}): {dist} km • {t}s
                        </Text>
                      );
                    }
                  })()}

                  {/* Labels above inputs (cardio only – strength labels sit above each box) */}
                  {exState.kind === "cardio" && (
                    <View style={styles.setsHeader}>
                      <Text style={styles.subtle}>Distance (km)</Text>
                      <Text style={[styles.subtle, { textAlign: "right" }]}>
                        Time (sec)
                      </Text>
                    </View>
                  )}

                  {/* Active set editor */}
                  {(() => {
                    const i = exState.currentSet;

                    if (exState.kind === "strength" && exState.dropMode) {
                      // DROPMODE: list of (reps, weight) inside the single current set
                      const set = exState.sets[i] as StrengthSet;
                      const drops = set.drops ?? [];

                      return (
                        <>
                          {drops.map((d, di) => {
                            const disableDeleteDrop =
                              drops.length <= 1 && di === 0;
                            return (
                              <View key={di} style={styles.setRow}>
                                <TextInput
                                  placeholder={
                                    we.target_reps != null
                                      ? String(we.target_reps)
                                      : "0"
                                  }
                                  keyboardType="numeric"
                                  value={d.reps ?? ""}
                                  onChangeText={(t) =>
                                    setState((s2) => {
                                      if (!s2) return s2;
                                      const ex = s2.byWeId[we.id];
                                      if (!ex || ex.kind !== "strength")
                                        return s2;
                                      const sets = ex.sets.slice();
                                      const cur = {
                                        ...(sets[i] as StrengthSet),
                                      };
                                      const arr = (cur.drops ?? []).slice();
                                      arr[di] = { ...arr[di], reps: t };
                                      cur.drops = arr;
                                      sets[i] = cur;
                                      return {
                                        ...s2,
                                        byWeId: {
                                          ...s2.byWeId,
                                          [we.id]: { ...ex, sets },
                                        },
                                      };
                                    })
                                  }
                                  style={[
                                    styles.input,
                                    styles.setInput,
                                    { marginRight: 8 },
                                  ]}
                                  placeholderTextColor={colors.subtle}
                                />
                                <TextInput
                                  placeholder={
                                    we.target_weight != null
                                      ? String(we.target_weight)
                                      : "0"
                                  }
                                  keyboardType="numeric"
                                  value={d.weight ?? ""}
                                  onChangeText={(t) =>
                                    setState((s2) => {
                                      if (!s2) return s2;
                                      const ex = s2.byWeId[we.id];
                                      if (!ex || ex.kind !== "strength")
                                        return s2;
                                      const sets = ex.sets.slice();
                                      const cur = {
                                        ...(sets[i] as StrengthSet),
                                      };
                                      const arr = (cur.drops ?? []).slice();
                                      arr[di] = { ...arr[di], weight: t };
                                      cur.drops = arr;
                                      sets[i] = cur;
                                      return {
                                        ...s2,
                                        byWeId: {
                                          ...s2.byWeId,
                                          [we.id]: { ...ex, sets },
                                        },
                                      };
                                    })
                                  }
                                  style={[styles.input, styles.setInput]}
                                  placeholderTextColor={colors.subtle}
                                />
                                <Pressable
                                  disabled={disableDeleteDrop}
                                  onPress={() =>
                                    setState((s2) => {
                                      if (!s2) return s2;
                                      const ex = s2.byWeId[we.id];
                                      if (!ex || ex.kind !== "strength")
                                        return s2;
                                      const sets = ex.sets.slice();
                                      const cur = {
                                        ...(sets[i] as StrengthSet),
                                      };
                                      const arr = (cur.drops ?? []).slice();
                                      if (
                                        arr.length > 1 &&
                                        di >= 0 &&
                                        di < arr.length
                                      ) {
                                        arr.splice(di, 1);
                                      }
                                      cur.drops = arr.length
                                        ? arr
                                        : [{ reps: "", weight: "" }];
                                      sets[i] = cur;
                                      return {
                                        ...s2,
                                        byWeId: {
                                          ...s2.byWeId,
                                          [we.id]: { ...ex, sets },
                                        },
                                      };
                                    })
                                  }
                                  style={[
                                    styles.removeBtn,
                                    disableDeleteDrop && { opacity: 0.4 },
                                  ]}
                                >
                                  <Text
                                    style={{
                                      color: colors.danger,
                                      fontWeight: "800",
                                    }}
                                  >
                                    −
                                  </Text>
                                </Pressable>
                              </View>
                            );
                          })}

                          <View
                            style={{ alignItems: "flex-end", marginTop: 6 }}
                          >
                            <Pressable
                              onPress={() =>
                                setState((s2) => {
                                  if (!s2) return s2;
                                  const ex = s2.byWeId[we.id];
                                  if (!ex || ex.kind !== "strength") return s2;
                                  const sets = ex.sets.slice();
                                  const cur = { ...(sets[i] as StrengthSet) };
                                  const arr = (cur.drops ?? []).slice();
                                  const seed = arr.length
                                    ? arr[arr.length - 1]
                                    : { reps: "", weight: "" };
                                  arr.push({
                                    reps: seed.reps || "",
                                    weight: seed.weight || "",
                                  });
                                  cur.drops = arr;
                                  sets[i] = cur;
                                  return {
                                    ...s2,
                                    byWeId: {
                                      ...s2.byWeId,
                                      [we.id]: { ...ex, sets },
                                    },
                                  };
                                })
                              }
                              style={[styles.pill, styles.ghost]}
                            >
                              <Text
                                style={{
                                  color: colors.text,
                                  fontWeight: "800",
                                }}
                              >
                                ＋ Add drop
                              </Text>
                            </Pressable>
                          </View>
                        </>
                      );
                    }

                    // NORMAL editing (non-drop or cardio)
                    const set = exState.sets[i];

                    if (exState.kind === "strength") {
                      // square, centred strength inputs with labels above
                      return (
                        <View style={styles.setRow}>
                          <View style={styles.setCol}>
                            <Text style={[styles.subtle, styles.setLabel]}>
                              Reps
                            </Text>
                            <TextInput
                              placeholder={
                                we.target_reps != null
                                  ? String(we.target_reps)
                                  : "0"
                              }
                              keyboardType="numeric"
                              value={(set as StrengthSet).reps ?? ""}
                              onChangeText={(t) =>
                                updateSet(we.id, i, { reps: t })
                              }
                              style={[styles.input, styles.setInput]}
                              placeholderTextColor={colors.subtle}
                            />
                          </View>

                          <View style={[styles.setCol, { marginLeft: 16 }]}>
                            <Text style={[styles.subtle, styles.setLabel]}>
                              Weight (kg)
                            </Text>
                            <TextInput
                              placeholder={
                                we.target_weight != null
                                  ? String(we.target_weight)
                                  : "0"
                              }
                              keyboardType="numeric"
                              value={(set as StrengthSet).weight ?? ""}
                              onChangeText={(t) =>
                                updateSet(we.id, i, { weight: t })
                              }
                              style={[styles.input, styles.setInput]}
                              placeholderTextColor={colors.subtle}
                            />
                          </View>
                        </View>
                      );
                    }

                    // CARDIO branch – keep wide inputs
                    return (
                      <View style={styles.setRow}>
                        <>
                          <TextInput
                            placeholder="0.00"
                            keyboardType="decimal-pad"
                            value={(set as CardioSet).distance ?? ""}
                            onChangeText={(t) =>
                              updateSet(we.id, i, { distance: t })
                            }
                            style={[styles.input, { flex: 1, marginRight: 8 }]}
                            placeholderTextColor={colors.subtle}
                          />
                          <TextInput
                            placeholder="0"
                            keyboardType="numeric"
                            value={(set as CardioSet).timeSec ?? ""}
                            onChangeText={(t) =>
                              updateSet(we.id, i, { timeSec: t })
                            }
                            style={[styles.input, { flex: 1 }]}
                            placeholderTextColor={colors.subtle}
                          />
                        </>

                        {/* Delete current set (disabled for first/only) */}
                        <Pressable
                          disabled={i === 0 || exState.sets.length <= 1}
                          onPress={() => removeLastSet(we.id)}
                          style={[
                            styles.removeBtn,
                            (i === 0 || exState.sets.length <= 1) && {
                              opacity: 0.4,
                            },
                          ]}
                        >
                          <Text
                            style={{ color: colors.danger, fontWeight: "800" }}
                          >
                            −
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })()}

                  {/* Pager + Prev / dots / Next-or-Complete */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 10,
                    }}
                  >
                    {/* Prev */}
                    <Pressable
                      disabled={exState.currentSet === 0}
                      onPress={() => setPrevSet(we.id)}
                      style={[
                        styles.pill,
                        styles.ghost,
                        exState.currentSet === 0 && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        ‹ Prev
                      </Text>
                    </Pressable>

                    {/* Dots */}
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {exState.sets.map((_, dotIdx) => (
                        <View
                          key={dotIdx}
                          style={[
                            styles.dot,
                            {
                              backgroundColor:
                                exState.currentSet === dotIdx
                                  ? colors.primaryText
                                  : colors.subtle,
                              opacity: exState.currentSet === dotIdx ? 1 : 0.4,
                            },
                          ]}
                        />
                      ))}
                    </View>

                    {/* Next / Complete */}
                    <Pressable
                      onPress={() =>
                        shouldShowComplete
                          ? completeExercise(we.id)
                          : setNextSet(we.id)
                      }
                      style={[
                        styles.pill,
                        shouldShowComplete ? styles.completePill : styles.ghost,
                      ]}
                    >
                      <Text
                        style={{
                          color: shouldShowComplete ? "white" : colors.text,
                          fontWeight: "800",
                        }}
                      >
                        {shouldShowComplete ? "✓ Complete" : "Next ›"}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Set progress text */}
                  <Text
                    style={[
                      styles.h3,
                      { textAlign: "center", marginTop: 8, marginBottom: 4 },
                    ]}
                  >
                    Set {exState.currentSet + 1} of {exState.sets.length}
                  </Text>

                  {/* Add / Remove Set */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      marginTop: 8,
                      justifyContent: "center",
                    }}
                  >
                    <Pressable
                      disabled={exState.sets.length <= 1}
                      onPress={() => removeLastSet(we.id)}
                      style={[
                        styles.pill,
                        styles.ghost,
                        exState.sets.length <= 1 && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        − Remove Set
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => addSet(we.id)}
                      style={[styles.pill, styles.ghost]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        ＋ Add Set
                      </Text>
                    </Pressable>
                  </View>

                  {/* Exercise notes */}
                  <TextInput
                    placeholder="Exercise notes"
                    value={exState.notes}
                    onChangeText={(t) =>
                      setState((s2) =>
                        s2
                          ? {
                              ...s2,
                              byWeId: {
                                ...s2.byWeId,
                                [we.id]: { ...s2.byWeId[we.id], notes: t },
                              },
                            }
                          : s2
                      )
                    }
                    style={[styles.notesInput, { marginTop: 12 }]}
                    placeholderTextColor={colors.subtle}
                    multiline
                  />
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Workout Notes (opens full-screen editor) */}
        <Pressable
          style={[styles.bigCard, { marginTop: 6 }]}
          onPress={() => setNotesOverlayVisible(true)}
        >
          <Text style={styles.h3}>Workout Notes</Text>
          {state.workoutNotes ? (
            <Text style={styles.notesPreview} numberOfLines={2}>
              {state.workoutNotes}
            </Text>
          ) : (
            <Text style={[styles.muted, { marginTop: 4 }]}>
              Tap to add notes about this workout
            </Text>
          )}

          {(workout.notes || lastWorkoutNotes) && (
            <View style={{ marginTop: 8 }}>
              {workout.notes ? (
                <Text style={styles.mutedSmall}>
                  Plan notes: {workout.notes}
                </Text>
              ) : null}
              {lastWorkoutNotes ? (
                <Text style={styles.mutedSmall}>
                  Last workout: {lastWorkoutNotes}
                </Text>
              ) : null}
            </View>
          )}
        </Pressable>

        {/* NEW: Add ad-hoc exercises for this workout only */}
        <View style={{ marginTop: 12, alignItems: "center" }}>
          <Pressable
            onPress={() => setExerciseModalVisible(true)}
            style={[styles.pill, { paddingHorizontal: 18 }]}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              ＋ Add exercise to this workout
            </Text>
          </Pressable>
          <Text
            style={[
              styles.muted,
              { marginTop: 4, fontSize: 12, textAlign: "center" },
            ]}
          >
            This exercise will only be saved as part of this workout&apos;s
            history.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          disabled={!state.anyCompleted}
          onPress={() => {
            stopLiveWorkout();
            const totalElapsedSec = Math.floor(
              (Date.now() - state.startedAt) / 1000
            );
            const durationWithCardio =
              totalElapsedSec + state.cardioTimeBonusSec;

            // capture a snapshot for review
            setReviewPayload({
              workout,
              state,
              supersets,
            });

            router.push({
              pathname: "/features/workouts/review",
              params: {
                workoutId: workout.id,
                elapsedSec: String(totalElapsedSec),
                bonusSec: String(state.cardioTimeBonusSec),
                totalSec: String(durationWithCardio),
                planWorkoutId,
              },
            });
          }}
          style={[
            styles.startBtn,
            {
              backgroundColor: state.anyCompleted ? "#22c55e" : colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: state.anyCompleted ? "white" : colors.muted,
              fontWeight: "900",
            }}
          >
            Complete Workout ({completedCount}/
            {workout.workout_exercises.length} exercises)
          </Text>
        </Pressable>
      </View>

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
            <Text style={s.modalTitle}>
              {isReplaceMode ? "Replace exercise" : "Select exercises"}
            </Text>
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

          {/* FILTER BAR — muscles & equipment on same line */}
          <View style={{ marginTop: 8 }}>
            <View style={s.filterBar}>
              {/* Muscles pill */}
              <Pressable
                onPress={() => setMuscleFilterOpen((open) => !open)}
                style={[
                  s.filterPill,
                  muscleFilterOpen && {
                    backgroundColor: colors.primaryBg ?? colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    s.filterPillLabel,
                    muscleFilterOpen && {
                      color: colors.primaryText ?? "#fff",
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
                        color: colors.primaryText ?? "#fff",
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
                    backgroundColor: colors.primaryBg ?? colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    s.filterPillLabel,
                    equipmentFilterOpen && {
                      color: colors.primaryText ?? "#fff",
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
                        color: colors.primaryText ?? "#fff",
                      },
                    ]}
                  >
                    {selectedEquipment.length}
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Summary text under the pills */}
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

          {/* MUSCLE CHIPS (when open) */}
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
            </View>
          )}

          {/* EQUIPMENT CHIPS (when open) */}
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
            </View>
          )}

          {/* List */}
          {exLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <FlatList
              data={filteredExerciseOptions}
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
              {isReplaceMode ? "Replace exercise" : "Add "}{" "}
              {isReplaceMode
                ? ""
                : `${modalSelectedIds.length || ""} exercise${
                    modalSelectedIds.length === 1 ? "" : "s"
                  }`}
            </Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    /* Layout helpers */
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
    },
    subtle: {
      fontSize: 12,
      color: colors.subtle,
    },

    /* Typography */
    h3: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    muted: {
      fontSize: 13,
      color: colors.subtle,
    },
    mutedSmall: {
      fontSize: 11,
      color: colors.subtle,
    },

    /* Cards */
    bigCard: {
      backgroundColor: colors.card ?? colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 4,
      elevation: 2,
    },
    bigCardActive: {
      borderColor: colors.primary,
      shadowOpacity: 0.16,
      shadowRadius: 6,
      elevation: 3,
    },

    /* Pills / badges / icons */
    pill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    ghost: {
      backgroundColor: "transparent",
    },
    completePill: {
      backgroundColor: colors.successText ?? "#22c55e",
      borderColor: "transparent",
    },
    badge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    /* Completed summary */
    completedSummaryContainer: {
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    completedSummaryLine: {
      fontSize: 13,
      color: colors.text,
      marginBottom: 2,
    },

    /* Sets header (cardio) */
    setsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
      paddingHorizontal: 2,
    },

    /* Inputs */
    input: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.surface,
      fontSize: 15,
      color: colors.text,
    },
    setInput: {
      minWidth: 72,
      textAlign: "center",
    },
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },
    setCol: {
      flex: 1,
    },
    setLabel: {
      marginBottom: 4,
    },
    removeBtn: {
      marginLeft: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },

    /* Pager dots */
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    /* Notes */
    notesInput: {
      minHeight: 60,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      textAlignVertical: "top",
    },
    notesPreview: {
      marginTop: 4,
      fontSize: 13,
      color: colors.text,
    },

    /* Footer */
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 10,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    startBtn: {
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Modal base */
    modalSafeArea: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    modalClose: {
      fontSize: 15,
      fontWeight: "600",
    },
    modalSearchInput: {
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 15,
    },

    /* Filter bar */
    filterBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      marginHorizontal: 16,
      marginTop: 8,
      columnGap: 8,
    },
    filterPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterPillLabel: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
    },
    filterPillCount: {
      marginLeft: 6,
      fontSize: 12,
      color: colors.subtle,
    },
    filterSummaryText: {
      marginTop: 4,
      marginHorizontal: 16,
      fontSize: 12,
      color: colors.subtle,
    },

    /* Chips (muscles / equipment) */
    chipSection: {
      marginTop: 8,
      paddingHorizontal: 16,
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 8,
      columnGap: 8,
    },
    chip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipLabel: {
      fontSize: 13,
      color: colors.text,
    },

    /* Exercise list rows */
    modalRow: {
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card ?? colors.surface,
      flexDirection: "row",
      alignItems: "center",
    },
    modalExerciseName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    modalExerciseMeta: {
      fontSize: 12,
      color: colors.subtle,
      marginTop: 2,
    },

    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 12,
    },

    /* Confirm button */
    modalDoneBtn: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 10,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
  });
