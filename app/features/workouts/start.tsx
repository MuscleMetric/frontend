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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  is_dropset?: boolean | null; // NEW: db flag to allow drop mode
  superset_group?: string | null; // 👈 NEW
  superset_index?: number | null;
  exercises: Exercise | null;
};

// In-progress logging
type StrengthDrop = { reps?: string; weight?: string };

type StrengthSet = {
  reps?: string;
  weight?: string;
  drops?: StrengthDrop[]; // when exercise dropMode is true, use this array (one set with many drops)
};

type CardioSet = { distance?: string; timeSec?: string };

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

/* ---------- main screen ---------- */
export default function StartWorkoutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const nav = useNavigation();

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

  // scrolling to open exercise
  const scrollRef = useRef<ScrollView>(null);
  const exerciseY = useRef<Record<string, number>>({});
  const scrollToExercise = (weId: string) => {
    const y = exerciseY.current[weId];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  };

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
      // ensure we stop if user navigates away
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

    let setLabel: string | undefined;
    let prevLabel: string | undefined;

    if (exState.kind === "strength") {
      const i = exState.currentSet;
      setLabel = `Set ${i + 1} of ${exState.sets.length}`;
      if (i > 0) {
        const last = exState.sets[i - 1] as any;
        if ((exState as any).dropMode) {
          const drops = (last.drops ?? []) as {
            reps?: string;
            weight?: string;
          }[];
          if (drops.length) {
            const chain = drops
              .map((d) => `${d.reps || 0}×${d.weight || 0}`)
              .join(" → ");
            prevLabel = `Last: ${chain}kg`;
          }
        } else if (last.reps || last.weight) {
          prevLabel = `Last: ${last.reps || 0}×${last.weight || 0}kg`;
        }
      }
    } else {
      const i = exState.currentSet;
      setLabel = `Set ${i + 1} of ${exState.sets.length}`;
      if (i > 0) {
        const last = exState.sets[i - 1] as any;
        if (last.distance || last.timeSec) {
          prevLabel = `Last: ${last.distance || 0} km • ${last.timeSec || 0}s`;
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
      const { data, error } = await supabase
        .from("workouts")
        .select(
          `
          id, title,
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

      // initialize in-progress state
      if (w) {
        const byWeId: Record<string, ExerciseState> = {};
        for (const we of w.workout_exercises) {
          if (isCardio(we)) {
            byWeId[we.id] = {
              kind: "cardio",
              sets: [{ distance: "", timeSec: "" }],
              currentSet: 0,
              completed: false,
              notes: "",
              open: false,
            };
          } else {
            let initialSets =
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

            byWeId[we.id] = {
              kind: "strength",
              sets: initialSets,
              currentSet: 0,
              dropMode: false, // exercise-level drop toggle off by default
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
    } finally {
      setLoading(false);
    }
  }, [userId, workoutId]);

  useEffect(() => {
    load();
  }, [load]);

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

  type SupersetInfo = {
    byGroup: Record<string, string[]>; // groupId -> ordered WE ids
    byWeId: Record<string, { group: string; pos: number }>;
    labels: Record<string, string>; // groupId -> "A", "B", ...
  };

  // Excel-style A, B, ..., Z, AA, AB, ...
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

  const setExerciseOpen = (weId: string, open: boolean) =>
    setState((s) => {
      if (!s) return s;
      const ex = s.byWeId[weId];
      if (!ex) return s;
      const next = { ...s, byWeId: { ...s.byWeId, [weId]: { ...ex, open } } };
      // scroll after open
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

  const removeSet = (weId: string, index: number) =>
    setState((s) => {
      if (!s) return s;
      const ex = s.byWeId[weId];
      if (!ex) return s;

      // prevent deleting first set or single remaining set
      if (index === 0 || ex.sets.length <= 1) return s;

      if (isStrengthState(ex)) {
        const nextSets = ex.sets.filter((_, i) => i !== index);
        const nextCurrent = Math.min(ex.currentSet, nextSets.length - 1);
        const next: typeof ex = {
          ...ex,
          sets: nextSets,
          currentSet: nextCurrent,
        };
        return { ...s, byWeId: { ...s.byWeId, [weId]: next } };
      }

      if (isCardioState(ex)) {
        const nextSets = ex.sets.filter((_, i) => i !== index);
        const nextCurrent = Math.min(ex.currentSet, nextSets.length - 1);
        const next: typeof ex = {
          ...ex,
          sets: nextSets,
          currentSet: nextCurrent,
        };
        return { ...s, byWeId: { ...s.byWeId, [weId]: next } };
      }

      return s;
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
          const updated = {
            ...s,
            byWeId: {
              ...s.byWeId,
              [prevWeId]: { ...prevEx, open: true },
              [weId]: { ...ex, open: false },
            },
          };
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
        const i = ex.currentSet;

        // 1) Increment current exercise's set index if we're at the end we can also create next set (prefill)
        const atEnd = i >= ex.sets.length - 1;

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

        // 2) Open NEXT exercise in the group (same set index as old i)
        const curPos = node.pos;
        const nextPos = (curPos + 1) % groupIds.length;
        const nextWeId = groupIds[nextPos];

        const nextEx = updated.byWeId[nextWeId];
        if (nextEx && !nextEx.completed) {
          // open it; keep others closed
          updated = {
            ...updated,
            byWeId: {
              ...updated.byWeId,
              [nextWeId]: { ...nextEx, open: true },
              [weId]: { ...updated.byWeId[weId], open: false },
            },
          };
          // scroll after state update
          requestAnimationFrame(() => scrollToExercise(nextWeId));
          return updated;
        }

        // if next is completed, fall back to default (non-superset) next-se t behavior
        return updated;
      }

      // --- Non-superset fallback: your original next logic ---
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
          const t = Number(st.timeSec || 0);
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
            updated.byWeId[candidateId] = { ...cand, open: true };
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
            updated.byWeId[nid] = { ...n, open: true };
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

                {!exState.completed ? (
                  isOpen ? (
                    <Text style={[styles.badge, { color: colors.warnText }]}>
                      Active
                    </Text>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setExerciseOpen(we.id, true);
                        requestAnimationFrame(() => scrollToExercise(we.id));
                      }}
                      style={[styles.pill, { borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        Start
                      </Text>
                    </Pressable>
                  )
                ) : (
                  <Text style={[styles.badge, { color: colors.successText }]}>
                    Done ✓
                  </Text>
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

              {/* Editor when open & not completed */}
              {isOpen && !exState.completed ? (
                <View style={{ marginTop: 14 }}>
                  {/* Exercise-level Drop Set toggle (for strength) */}
                  {exState.kind === "strength" && we.is_dropset ? (
                    <View style={{ marginBottom: 8 }}>
                      <Pressable
                        onPress={() =>
                          setState((s) => {
                            if (!s) return s;
                            const ex = s.byWeId[we.id];
                            if (!ex || ex.kind !== "strength") return s;
                            const next = { ...ex, dropMode: !ex.dropMode };
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
                              ...s,
                              byWeId: { ...s.byWeId, [we.id]: next },
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

                  {/* Labels above inputs */}
                  <View style={styles.setsHeader}>
                    {exState.kind === "strength" ? (
                      <>
                        <Text style={styles.subtle}>Reps</Text>
                        <Text style={[styles.subtle, { textAlign: "right" }]}>
                          Weight (kg)
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.subtle}>Distance (km)</Text>
                        <Text style={[styles.subtle, { textAlign: "right" }]}>
                          Time (sec)
                        </Text>
                      </>
                    )}
                  </View>

                  {/* Last set preview */}
                  {(() => {
                    const i = exState.currentSet;
                    const last = i > 0 ? exState.sets[i - 1] : null;
                    if (!last) return null;
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
                        Last:{" "}
                        {exState.kind === "strength"
                          ? (() => {
                              const L = last as StrengthSet;
                              if (exState.dropMode) {
                                const drops = L.drops ?? [];
                                const chain = drops.length
                                  ? drops
                                      .map(
                                        (d) => `${d.reps || 0}×${d.weight || 0}`
                                      )
                                      .join(" → ")
                                  : `${L.reps || 0}×${L.weight || 0}`;
                                return `${chain}kg`;
                              } else {
                                return `${L.reps || 0} × ${L.weight || 0}kg`;
                              }
                            })()
                          : `${(last as CardioSet)?.distance || 0} km • ${
                              (last as CardioSet)?.timeSec || 0
                            }s`}
                      </Text>
                    );
                  })()}

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
                                  placeholder="0"
                                  keyboardType="numeric"
                                  value={d.reps ?? ""}
                                  onChangeText={(t) =>
                                    setState((s) => {
                                      if (!s) return s;
                                      const ex = s.byWeId[we.id];
                                      if (!ex || ex.kind !== "strength")
                                        return s;
                                      const sets = ex.sets.slice();
                                      const cur = {
                                        ...(sets[i] as StrengthSet),
                                      };
                                      const arr = (cur.drops ?? []).slice();
                                      arr[di] = { ...arr[di], reps: t };
                                      cur.drops = arr;
                                      sets[i] = cur;
                                      return {
                                        ...s,
                                        byWeId: {
                                          ...s.byWeId,
                                          [we.id]: { ...ex, sets },
                                        },
                                      };
                                    })
                                  }
                                  style={[styles.input, { marginRight: 8 }]}
                                  placeholderTextColor={colors.subtle}
                                />
                                <TextInput
                                  placeholder="0"
                                  keyboardType="numeric"
                                  value={d.weight ?? ""}
                                  onChangeText={(t) =>
                                    setState((s) => {
                                      if (!s) return s;
                                      const ex = s.byWeId[we.id];
                                      if (!ex || ex.kind !== "strength")
                                        return s;
                                      const sets = ex.sets.slice();
                                      const cur = {
                                        ...(sets[i] as StrengthSet),
                                      };
                                      const arr = (cur.drops ?? []).slice();
                                      arr[di] = { ...arr[di], weight: t };
                                      cur.drops = arr;
                                      sets[i] = cur;
                                      return {
                                        ...s,
                                        byWeId: {
                                          ...s.byWeId,
                                          [we.id]: { ...ex, sets },
                                        },
                                      };
                                    })
                                  }
                                  style={styles.input}
                                  placeholderTextColor={colors.subtle}
                                />
                                <Pressable
                                  disabled={disableDeleteDrop}
                                  onPress={() =>
                                    setState((s) => {
                                      if (!s) return s;
                                      const ex = s.byWeId[we.id];
                                      if (!ex || ex.kind !== "strength")
                                        return s;
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
                                        ...s,
                                        byWeId: {
                                          ...s.byWeId,
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
                                setState((s) => {
                                  if (!s) return s;
                                  const ex = s.byWeId[we.id];
                                  if (!ex || ex.kind !== "strength") return s;
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
                                    ...s,
                                    byWeId: {
                                      ...s.byWeId,
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
                    return (
                      <View style={styles.setRow}>
                        {exState.kind === "strength" ? (
                          <>
                            <TextInput
                              placeholder="0"
                              keyboardType="numeric"
                              value={(set as StrengthSet).reps ?? ""}
                              onChangeText={(t) =>
                                updateSet(we.id, i, { reps: t })
                              }
                              style={[styles.input, { marginRight: 8 }]}
                              placeholderTextColor={colors.subtle}
                            />
                            <TextInput
                              placeholder="0"
                              keyboardType="numeric"
                              value={(set as StrengthSet).weight ?? ""}
                              onChangeText={(t) =>
                                updateSet(we.id, i, { weight: t })
                              }
                              style={styles.input}
                              placeholderTextColor={colors.subtle}
                            />
                          </>
                        ) : (
                          <>
                            <TextInput
                              placeholder="0.00"
                              keyboardType="decimal-pad"
                              value={(set as CardioSet).distance ?? ""}
                              onChangeText={(t) =>
                                updateSet(we.id, i, { distance: t })
                              }
                              style={[styles.input, { marginRight: 8 }]}
                              placeholderTextColor={colors.subtle}
                            />
                            <TextInput
                              placeholder="0"
                              keyboardType="numeric"
                              value={(set as CardioSet).timeSec ?? ""}
                              onChangeText={(t) =>
                                updateSet(we.id, i, { timeSec: t })
                              }
                              style={styles.input}
                              placeholderTextColor={colors.subtle}
                            />
                          </>
                        )}

                        {/* Delete current set (disabled for first/only) */}
                        <Pressable
                          disabled={i === 0 || exState.sets.length <= 1}
                          onPress={() => removeSet(we.id, i)}
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

                  {/* Pager + Prev / Dots / Next */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 10,
                    }}
                  >
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

                    <Pressable
                      onPress={() => setNextSet(we.id)}
                      style={[styles.pill, styles.ghost]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        Next ›
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

                  {/* Add / Complete */}
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    <Pressable
                      onPress={() => addSet(we.id)}
                      style={[styles.pill, styles.ghost]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        ＋ Add Set
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => completeExercise(we.id)}
                      style={[styles.pill, { backgroundColor: "#22c55e" }]}
                    >
                      <Text style={{ color: "white", fontWeight: "800" }}>
                        ✓ Complete Exercise
                      </Text>
                    </Pressable>
                  </View>

                  {/* Exercise notes */}
                  <TextInput
                    placeholder="Exercise notes"
                    value={exState.notes}
                    onChangeText={(t) =>
                      setState((s) =>
                        s
                          ? {
                              ...s,
                              byWeId: {
                                ...s.byWeId,
                                [we.id]: { ...s.byWeId[we.id], notes: t },
                              },
                            }
                          : s
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

        {/* Workout Notes */}
        <View style={[styles.bigCard, { marginTop: 6 }]}>
          <Text style={styles.h3}>Workout Notes</Text>
          <TextInput
            placeholder="Add any general notes for this workout"
            value={state.workoutNotes}
            onChangeText={(t) =>
              setState((s) => (s ? { ...s, workoutNotes: t } : s))
            }
            style={[styles.notesInput, { marginTop: 8 }]}
            placeholderTextColor={colors.subtle}
            multiline
          />
        </View>
      </ScrollView>

      {/* Sticky Footer (raised a bit) */}
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
              supersets, // you already compute this for supersets A, B, ...
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
    </SafeAreaView>
  );
}

/* ---------- themed styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.background,
    },
    title: { fontSize: 24, fontWeight: "900", color: colors.text },
    subtle: { color: colors.subtle },

    bigCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 12,
    },
    bigCardActive: {
      borderColor: colors.primaryText,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    muted: { color: colors.muted },

    pill: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    ghost: { backgroundColor: colors.surface },

    badge: {
      fontSize: 12,
      fontWeight: "800",
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    setsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
      paddingHorizontal: 4,
    },
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      color: colors.text,
    },
    removeBtn: {
      marginLeft: 8,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    notesInput: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      minHeight: 44,
      color: colors.text,
    },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 10, // raised slightly
      backgroundColor: colors.background,
      padding: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    startBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 999,
    },

    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
