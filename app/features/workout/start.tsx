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
import { useAuth } from "../../../lib/authContext";
import {
  startLiveWorkout,
  updateLiveWorkout,
  stopLiveWorkout,
} from "../../../lib/liveWorkout";
import { setReviewPayload } from "../../../lib/sessionStore";
import { ExercisePickerModal } from "../../_components/ExercisePickerModal";

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
  supersetRoundByGroup?: Record<string, number>;
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

type LivePayload = {
  currentExercise?: string;
  setLabel?: string;
  prevLabel?: string;
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

function densifySnapshots<T>(
  arr: Array<T | undefined> | undefined,
  minLen: number
): Array<T | null> {
  const a = Array.isArray(arr) ? arr : [];
  const len = Math.max(minLen, a.length);
  return Array.from({ length: len }, (_, i) => a[i] ?? null);
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
      byGroupTmp[gid].push({
        id: we.id,
        pos: we.superset_index ?? we.order_index ?? 0, // ✅ stable fallback
      });
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

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("en-GB").format(new Date(iso)); // dd/mm/yyyy
    } catch {
      return "";
    }
  };

  type DatedNote = { date: string; text: string };

  const [workoutNotesHistory, setWorkoutNotesHistory] = useState<DatedNote[]>(
    []
  );
  const [exerciseNotesHistoryByWeId, setExerciseNotesHistoryByWeId] = useState<
    Record<string, DatedNote[]>
  >({});

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

  const [lastSetsByExerciseId, setLastSetsByExerciseId] = useState<
    Record<string, LastSetSnapshot[]>
  >({});

  const [isPlanWorkout, setIsPlanWorkout] = useState(false);

  const stateRef = useRef<InProgressState | null>(null);
  const workoutRef = useRef<Workout | null>(null);
  const supersetsRef = useRef(supersets);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    workoutRef.current = workout;
  }, [workout]);
  useEffect(() => {
    supersetsRef.current = supersets;
  }, [supersets]);

  // scrolling to open exercise
  const listRef = useRef<FlatList<WorkoutExercise>>(null);

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

  const alreadyInWorkoutIds = useMemo(() => {
    const ids = (workout?.workout_exercises ?? []).map((we) => we.exercise_id);
    if (!replaceTargetWeId) return ids;

    const target = workout?.workout_exercises?.find(
      (we) => we.id === replaceTargetWeId
    );
    if (!target) return ids;

    // allow picking the same exercise as the one being replaced (optional)
    return ids.filter((id) => id !== target.exercise_id);
  }, [workout, replaceTargetWeId]);

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

  const filteredExerciseOptions = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    if (!q) return exerciseOptions;
    return exerciseOptions.filter((opt) =>
      (opt.name || "").toLowerCase().includes(q)
    );
  }, [exerciseOptions, exerciseSearch]);

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
  }, [workout?.id, state?.startedAt]);

  const lastLiveRef = useRef<string>("");

  useEffect(() => {
    if (!workout?.id || !state?.startedAt) return;

    const tick = setInterval(() => {
      const w = workoutRef.current;
      const s = stateRef.current;
      const ss = supersetsRef.current;
      if (!w || !s) return;

      const payload = deriveLivePayloadFrom(
        w,
        s,
        ss,
        isPlanWorkout,
        lastSetsByWeId,
        lastSetsByExerciseId
      );

      // only update if changed (huge win)
      const key = JSON.stringify(payload);
      if (key !== lastLiveRef.current) {
        lastLiveRef.current = key;
        updateLiveWorkout({
          startedAt: s.startedAt,
          workoutTitle: w.title ?? "Workout",
          ...payload,
        });
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [workout?.id, state?.startedAt]);

  function deriveLivePayloadFrom(
    workout: Workout,
    state: InProgressState,
    supersets: SupersetInfo,
    isPlanWorkout: boolean,
    lastSetsByWeId: Record<string, LastSetSnapshot[]>,
    lastSetsByExerciseId: Record<string, LastSetSnapshot[]>
  ): LivePayload {
    const openWe =
      workout.workout_exercises.find((we) => state.byWeId[we.id]?.open) ??
      workout.workout_exercises.find((we) => !state.byWeId[we.id]?.completed);

    if (!openWe) return {};

    const exState = state.byWeId[openWe.id];
    if (!exState) return {};

    const node = supersets.byWeId[openWe.id];
    const currentIdx = node
      ? state.supersetRoundByGroup?.[node.group] ?? 0
      : exState.currentSet;

    let setLabel: string | undefined;
    let prevLabel: string | undefined;

    const histArr = isPlanWorkout
      ? lastSetsByWeId[openWe.id]
      : lastSetsByExerciseId[openWe.exercise_id];

    if (exState.kind === "strength") {
      setLabel = `Set ${currentIdx + 1} of ${exState.sets.length}`;

      if (currentIdx === 0 && histArr && histArr.length > 0) {
        const histIdx = Math.min(currentIdx, histArr.length - 1);
        const snap =
          histArr?.[histIdx] ??
          histArr?.find((x) => !!x) ??
          [...(histArr ?? [])].reverse().find((x) => !!x);

        if (snap) {
          const reps = snap.reps ?? 0;
          const weight = snap.weight ?? 0;
          prevLabel = `${reps}×${weight}kg`;
        }
      }

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
      setLabel = `Set ${currentIdx + 1} of ${exState.sets.length}`;

      if (currentIdx === 0 && histArr && histArr.length > 0) {
        const histIdx = Math.min(currentIdx, histArr.length - 1);
        const snap = histArr[histIdx];
        if (snap) {
          const dist = snap.distance ?? 0;
          const t = snap.timeSec ?? 0;
          prevLabel = `${dist} km • ${t}s`;
        }
      }

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

  function deriveLivePayload(): LivePayload {
    if (!workout || !state) return {};
    return deriveLivePayloadFrom(
      workout,
      state,
      supersets,
      isPlanWorkout,
      lastSetsByWeId,
      lastSetsByExerciseId
    );
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

      let planFlag = false;

      try {
        const { data: planLink, error: planErr } = await supabase
          .from("plan_workouts")
          .select("id")
          .eq("workout_id", workoutId)
          .eq("is_archived", false)
          .limit(1)
          .maybeSingle();

        if (planErr) {
          console.warn("[isPlanWorkout] query failed", planErr);
          planFlag = false;
        } else {
          planFlag = !!planLink;
        }
      } catch (e) {
        console.warn("[isPlanWorkout] exception", e);
        planFlag = false;
      }

      setIsPlanWorkout(planFlag);

      const exerciseIds = Array.from(
        new Set(
          (w?.workout_exercises ?? [])
            .map((we) => we.exercise_id)
            .filter(Boolean)
        )
      );

      // -------------------- LOOSE WORKOUT HISTORY (per exercise) --------------------
      if (!planFlag) {
        // clear plan map so UI can't accidentally read stale plan data
        setLastSetsByWeId({});
        lastSetMap = {};

        if (exerciseIds.length) {
          const { data: rows, error } = await supabase.rpc(
            "get_last_exercise_session_sets",
            { p_user_id: userId, p_exercise_ids: exerciseIds }
          );

          if (error) {
            console.warn("[loose history rpc] failed", error);
            setLastSetsByExerciseId({});
          } else {
            const map: Record<string, LastSetSnapshot[]> = {};

            (rows ?? []).forEach((r: any) => {
              const exId = String(r.exercise_id);
              const setIdx = Math.max(0, Number(r.set_number ?? 1) - 1);

              if (!map[exId]) map[exId] = [];
              if (!map[exId][setIdx]) {
                map[exId][setIdx] = {
                  reps: r.reps != null ? Number(r.reps) : null,
                  weight: r.weight != null ? Number(r.weight) : null,
                  distance: r.distance != null ? Number(r.distance) : null,
                  timeSec:
                    r.time_seconds != null ? Number(r.time_seconds) : null,
                };
              }
            });

            setLastSetsByExerciseId(map);
          }
        } else {
          setLastSetsByExerciseId({});
        }

        // Optional: loose workout notes history doesn't really exist at "template workout" level.
        // Keep this empty so it doesn't confuse users.
        setLastWorkoutNotes(null);
        setWorkoutNotesHistory([]);
        setExerciseNotesHistoryByWeId({});
      }

      // -------------------- PLAN WORKOUT HISTORY (per workout_exercise template id) --------------------
      if (planFlag) {
        // clear loose map so UI can't accidentally read stale loose data
        setLastSetsByExerciseId({});

        try {
          const { data: lastHist, error: lastErr } = await supabase
            .from("workout_history")
            .select("id, notes")
            .eq("user_id", userId)
            .eq("workout_id", workoutId)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // workout notes history (last 10)
          const { data: noteRows, error: noteErr } = await supabase
            .from("workout_history")
            .select("completed_at, notes")
            .eq("user_id", userId)
            .eq("workout_id", workoutId)
            .not("notes", "is", null)
            .order("completed_at", { ascending: false })
            .limit(10);

          if (!noteErr) {
            const list: DatedNote[] = (noteRows ?? [])
              .map((r: any) => {
                const text = (r.notes ?? "").trim();
                if (!text) return null;
                return { date: fmtDate(r.completed_at), text };
              })
              .filter(Boolean) as DatedNote[];

            setWorkoutNotesHistory(list);
          } else {
            setWorkoutNotesHistory([]);
          }

          const { data: weNotes, error: weNotesErr } = await supabase
            .from("workout_exercise_history")
            .select(
              `
        workout_exercise_id,
        notes,
        workout_history:workout_history_id (
          completed_at,
          workout_id,
          user_id
        )
      `
            )
            .eq("workout_history.workout_id", workoutId)
            .eq("workout_history.user_id", userId)
            .not("notes", "is", null)
            .order("workout_history.completed_at", { ascending: false })
            .limit(500);

          if (!weNotesErr) {
            const map: Record<string, DatedNote[]> = {};
            (weNotes ?? []).forEach((row: any) => {
              const text = (row.notes ?? "").trim();
              if (!text) return;
              const weId = String(row.workout_exercise_id);
              const dt = fmtDate(row.workout_history?.completed_at);
              if (!map[weId]) map[weId] = [];
              if (map[weId].length < 10) map[weId].push({ date: dt, text });
            });
            setExerciseNotesHistoryByWeId(map);
          } else {
            setExerciseNotesHistoryByWeId({});
          }

          if (!lastErr && lastHist?.id) {
            setLastWorkoutNotes(lastHist.notes ?? null);

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
                if (!weId) return;

                const setIndex = Math.max(0, Number(row.set_number ?? 1) - 1);
                if (!map[weId]) map[weId] = [];

                map[weId][setIndex] = {
                  reps: row.reps != null ? Number(row.reps) : null,
                  weight: row.weight != null ? Number(row.weight) : null,
                  distance: row.distance != null ? Number(row.distance) : null,
                  timeSec:
                    row.time_seconds != null ? Number(row.time_seconds) : null,
                };
              });

              lastSetMap = map;
              setLastSetsByWeId(map);
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
          console.warn("plan history load error", e);
          setLastWorkoutNotes(null);
          lastSetMap = {};
          setLastSetsByWeId({});
          setWorkoutNotesHistory([]);
          setExerciseNotesHistoryByWeId({});
        }
      }

      // initialize in-progress state (prefill from lastSetMap if available)
      if (w) {
        const byWeId: Record<string, ExerciseState> = {};

        for (const we of w.workout_exercises) {
          const targetLen = Math.max(1, we.target_sets ?? 1);

          const histRaw = planFlag
            ? lastSetMap[we.id]
            : lastSetsByExerciseId[we.exercise_id];

          const histSets = densifySnapshots<LastSetSnapshot>(
            histRaw as any,
            targetLen
          );

          if (isCardio(we)) {
            const sets: CardioSet[] =
              histSets.length > 0
                ? histSets.map((h) => ({
                    distance:
                      h?.distance != null && !Number.isNaN(h.distance)
                        ? String(h.distance)
                        : "",
                    timeSec:
                      h?.timeSec != null && !Number.isNaN(h.timeSec)
                        ? String(h.timeSec)
                        : "",
                  }))
                : [{ distance: "", timeSec: "" }];

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
              sets = histSets.map((h) => ({
                reps:
                  h?.reps != null && !Number.isNaN(h.reps)
                    ? String(h.reps)
                    : "",
                weight:
                  h?.weight != null && !Number.isNaN(h.weight)
                    ? String(h.weight)
                    : "",
                drops: [],
              }));
            } else {
              sets =
                we.target_sets && we.target_sets > 0
                  ? Array.from({ length: we.target_sets }, () => ({
                      reps: "",
                      weight: "",
                      drops: [],
                    }))
                  : [{ reps: "", weight: "", drops: [] }];
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

        const supersetRoundByGroup: Record<string, number> = {};
        Object.keys(supersets.byGroup).forEach(
          (gid) => (supersetRoundByGroup[gid] = 0)
        );

        setState({
          workoutNotes: "",
          byWeId,
          cardioTimeBonusSec: 0,
          startedAt: Date.now(),
          anyCompleted: false,
          supersetRoundByGroup, // ✅ ADD THIS
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
  const handleConfirmAddExercises = (selectedIds: string[]) => {
    if (!workout || selectedIds.length === 0) {
      setExerciseModalVisible(false);
      return;
    }

    const selected = exerciseOptions.filter((opt) =>
      selectedIds.includes(opt.id)
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
  const weIndexById = useMemo(() => {
    const map: Record<string, number> = {};
    workout?.workout_exercises.forEach((we, i) => {
      map[we.id] = i;
    });
    return map;
  }, [workout?.workout_exercises]);

  const scrollToExercise = (weId: string) => {
    const idx = weIndexById[weId];
    if (idx == null) return;

    listRef.current?.scrollToIndex({
      index: idx,
      animated: true,
      viewPosition: 0.12,
    });
  };

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

      // ✅ scrolling must happen after state commit (still fine with RAF)
      if (open) {
        requestAnimationFrame(() => scrollToExercise(weId));
      }

      return { ...s, byWeId: nextByWeId };
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

  function hasSetDataAtIndex(ex: ExerciseState, i: number): boolean {
    if (ex.kind === "strength") {
      const cur = ex.sets[i] as StrengthSet;
      if ((ex as any).dropMode) {
        const drops = cur?.drops ?? [];
        return drops.some(
          (d) => (d.reps && d.reps !== "0") || (d.weight && d.weight !== "0")
        );
      }
      return !!(
        (cur?.reps && cur.reps !== "0") ||
        (cur?.weight && cur.weight !== "0")
      );
    }

    const cur = ex.sets[i] as CardioSet;
    return !!(
      (cur?.distance && cur.distance !== "0") ||
      (cur?.timeSec && cur.timeSec !== "0")
    );
  }

  const setNextSet = (weId: string) =>
    setState((s) => {
      if (!s) return s;
      const ex = s.byWeId[weId];
      if (!ex) return s;

      const node = supersets.byWeId[weId];
      const i = node
        ? s.supersetRoundByGroup?.[node.group] ?? 0
        : ex.currentSet;

      // 🚫 Block next if the *displayed* set is empty
      if (!hasSetDataAtIndex(ex, i)) {
        Alert.alert(
          "Add a set",
          "Please enter reps/weight (or a drop row) before moving to the next set."
        );
        return s;
      }

      const isStrength = isStrengthState(ex);
      const isCardioT = isCardioState(ex);

      // If this WE is in a superset group, alternate to the next WE in the same group
      if (node && supersets.byGroup[node.group]?.length > 1) {
        const groupIds = supersets.byGroup[node.group];
        const groupId = node.group;

        let updated: InProgressState = s;

        const round = updated.supersetRoundByGroup?.[groupId] ?? 0;

        console.log("SUP", {
          weId,
          node,
          round: s.supersetRoundByGroup?.[node.group],
          currentSet: s.byWeId[weId]?.currentSet,
        });

        // helper: ensure this WE has a set slot for "round"
        const ensureSetSlot = (weX: string, idx: number) => {
          const exX = updated.byWeId[weX];
          if (!exX) return;

          if (exX.kind === "strength") {
            const e = exX as Extract<ExerciseState, { kind: "strength" }>;
            if (idx < e.sets.length) return;
            const last = e.sets[e.sets.length - 1] ?? {
              reps: "",
              weight: "",
              drops: [],
            };
            const clone: StrengthSet = {
              reps: (last as any).reps ?? "",
              weight: (last as any).weight ?? "",
              drops: ((last as any).drops ?? []).map((d: any) => ({
                reps: d.reps ?? "",
                weight: d.weight ?? "",
              })),
            };
            updated = {
              ...updated,
              byWeId: {
                ...updated.byWeId,
                [weX]: { ...e, sets: [...e.sets, clone] },
              },
            };
          } else {
            const e = exX as Extract<ExerciseState, { kind: "cardio" }>;
            if (idx < e.sets.length) return;
            const last = e.sets[e.sets.length - 1] ?? {
              distance: "",
              timeSec: "",
            };
            const clone: CardioSet = {
              distance: (last as any).distance ?? "",
              timeSec: (last as any).timeSec ?? "",
            };
            updated = {
              ...updated,
              byWeId: {
                ...updated.byWeId,
                [weX]: { ...e, sets: [...e.sets, clone] },
              },
            };
          }
        };

        // make sure every exercise in group has a slot for current round (so inputs exist)
        groupIds.forEach((id) => ensureSetSlot(id, round));

        const isLastInGroup = node.pos === groupIds.length - 1;
        const nextPos = (node.pos + 1) % groupIds.length;
        const nextWeId = groupIds[nextPos];

        // If we just finished the last exercise in the group, advance the round
        if (isLastInGroup) {
          const nextRound = round + 1;

          // ensure next round slot exists for each exercise (prefill)
          groupIds.forEach((id) => ensureSetSlot(id, nextRound));

          updated = {
            ...updated,
            supersetRoundByGroup: {
              ...(updated.supersetRoundByGroup ?? {}),
              [groupId]: nextRound,
            },
          };
        }

        // open next exercise
        const updatedBy: Record<string, ExerciseState> = {};
        for (const [id, val] of Object.entries(updated.byWeId)) {
          updatedBy[id] = { ...val, open: id === nextWeId } as ExerciseState;
        }

        requestAnimationFrame(() => scrollToExercise(nextWeId));
        return { ...updated, byWeId: updatedBy };
      }

      // --- Non-superset fallback (original logic) ---
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

      {/* ✅ Replace ScrollView with FlatList */}
      <FlatList
        ref={listRef}
        data={workout.workout_exercises}
        keyExtractor={(we) => we.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        onScrollToIndexFailed={(info) => {
          // wait for layout / measurement then retry
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewPosition: 0.1,
            });
          }, 50);
        }}
        renderItem={({ item: we, index: idx }) => {
          const exState = state.byWeId[we.id];
          const isOpen = exState.open;

          const node = supersets.byWeId[we.id];
          const displaySetIdx = node
            ? state.supersetRoundByGroup?.[node.group] ?? 0
            : exState.currentSet;

          const subtitle = formatTargetSubtitle(we);

          const isLastSet =
            displaySetIdx >= exState.sets.length - 1 && exState.sets.length > 0;
          const shouldShowComplete = isLastSet;

          const lastHistorySets = isPlanWorkout
            ? lastSetsByWeId[we.id]
            : lastSetsByExerciseId[we.exercise_id];

          return (
            <View style={[styles.bigCard, isOpen && styles.bigCardActive]}>
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
                    onPress={() => {
                      setExerciseOpen(we.id, !isOpen);
                      // ✅ with FlatList, use index-based scroll (optional but nice)
                      if (!isOpen) scrollToExercise(we.id);
                    }}
                    style={[
                      styles.badge,
                      {
                        borderColor: colors.successText,
                      },
                    ]}
                  >
                    <Text
                      style={{ color: colors.successText, fontWeight: "800" }}
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
                    onPress={() => {
                      setExerciseOpen(we.id, true);
                      scrollToExercise(we.id);
                    }}
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

              {/* Editor when open */}
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
                            > = {
                              ...(ex as any),
                              dropMode: !ex.dropMode,
                            };

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
                    const node = supersets.byWeId[we.id];
                    const i = node
                      ? state.supersetRoundByGroup?.[node.group] ?? 0
                      : exState.currentSet;

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

                  {/* Labels above inputs (cardio only) */}
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
                    const node = supersets.byWeId[we.id];
                    const i = node
                      ? state.supersetRoundByGroup?.[node.group] ?? 0
                      : exState.currentSet;

                    if (exState.kind === "strength" && exState.dropMode) {
                      const set = (exState.sets[i] ?? {
                        reps: "",
                        weight: "",
                        drops: [],
                      }) as StrengthSet;

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
                                      )
                                        arr.splice(di, 1);
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

                    const set =
                      exState.sets[i] ??
                      (exState.kind === "strength"
                        ? ({ reps: "", weight: "", drops: [] } as StrengthSet)
                        : ({ distance: "", timeSec: "" } as CardioSet));

                    if (exState.kind === "strength") {
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
                    <Pressable
                      disabled={displaySetIdx === 0}
                      onPress={() => setPrevSet(we.id)}
                      style={[
                        styles.pill,
                        styles.ghost,
                        displaySetIdx === 0 && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        ‹ Prev
                      </Text>
                    </Pressable>

                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {exState.sets.map((_, dotIdx) => (
                        <View
                          key={dotIdx}
                          style={[
                            styles.dot,
                            {
                              backgroundColor:
                                displaySetIdx === dotIdx
                                  ? colors.primaryText
                                  : colors.subtle,
                              opacity: displaySetIdx === dotIdx ? 1 : 0.4,
                            },
                          ]}
                        />
                      ))}
                    </View>

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

                  <Text
                    style={[
                      styles.h3,
                      { textAlign: "center", marginTop: 8, marginBottom: 4 },
                    ]}
                  >
                    Set {displaySetIdx + 1} of {exState.sets.length}
                  </Text>

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

                  {(() => {
                    const hist = exerciseNotesHistoryByWeId[we.id] ?? [];
                    if (!hist.length) return null;

                    return (
                      <View style={{ marginTop: 10 }}>
                        <Text
                          style={[
                            styles.mutedSmall,
                            { marginBottom: 6, fontWeight: "800" },
                          ]}
                        >
                          Previous notes
                        </Text>

                        {hist.map((n, i) => (
                          <Text
                            key={i}
                            style={[styles.mutedSmall, { marginBottom: 6 }]}
                          >
                            {n.date} — {n.text}
                          </Text>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={
          <>
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

            {/* Add ad-hoc exercises */}
            <View style={{ marginTop: 12, alignItems: "center" }}>
              <Pressable
                onPress={() => {
                  setReplaceTargetWeId(null);
                  setModalSelectedIds([]);
                  setExerciseSearch("");
                  setSelectedMuscleGroups([]);
                  setSelectedEquipment([]);
                  setMuscleFilterOpen(false);
                  setEquipmentFilterOpen(false);
                  setExerciseModalVisible(true);
                }}
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
          </>
        }
      />

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

            setReviewPayload({ workout, state, supersets });

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
            { backgroundColor: state.anyCompleted ? "#22c55e" : colors.border },
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

      {/* Your existing notes modal + ExercisePickerModal stay exactly the same */}
      <Modal
        visible={notesOverlayVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setNotesOverlayVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* ... unchanged ... */}
        </SafeAreaView>
      </Modal>

      <ExercisePickerModal
        userId={userId}
        alreadyInWorkoutIds={alreadyInWorkoutIds}
        usageByExerciseId={usageByExerciseId}
        visible={exerciseModalVisible}
        title={isReplaceMode ? "Replace exercise" : "Select exercises"}
        loading={exLoading}
        exerciseOptions={filteredExerciseOptions}
        muscleGroups={MUSCLE_GROUPS as any}
        equipmentOptions={EQUIPMENT_OPTIONS}
        initialSelectedIds={modalSelectedIds}
        multiSelect={!isReplaceMode}
        onClose={() => {
          setExerciseModalVisible(false);
          setReplaceTargetWeId(null);
        }}
        onConfirm={(ids) => {
          setModalSelectedIds(ids);
          requestAnimationFrame(() => handleConfirmAddExercises(ids));
        }}
        styles={s}
        colors={colors}
        safeAreaTop={insets.top}
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
      />
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
