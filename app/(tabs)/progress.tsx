import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/authContext";
import { useAppTheme } from "../../lib/useAppTheme";
const V = require("victory-native");

// Guard every component so it's never undefined at render time
const VictoryChart = V?.VictoryChart ?? V?.default?.VictoryChart;
const VictoryAxis = V?.VictoryAxis ?? V?.default?.VictoryAxis;
const VictoryLine = V?.VictoryLine ?? V?.default?.VictoryLine;
const VictoryScatter = V?.VictoryScatter ?? V?.default?.VictoryScatter;
const VictoryLegend = V?.VictoryLegend ?? V?.default?.VictoryLegend;
const VictoryGroup = V?.VictoryGroup ?? V?.default?.VictoryGroup;
const VictoryLabel = V?.VictoryLabel ?? V?.default?.VictoryLabel;
const VictoryBar = V?.VictoryBar ?? V?.default?.VictoryBar;
const themeMaterial = V?.VictoryTheme?.material ?? undefined;

// (optional) one-time sanity log
console.log(
  "victory-native keys:",
  Object.keys(V || {}),
  "default:",
  Object.keys(V?.default || {})
);

// ===== Types =====
type ExerciseRow = {
  id: string;
  name: string;
  type?: string | null;
};

type ExerciseStat = {
  exercise: ExerciseRow;
  currentWeight?: number | null;
  bestSet?: { weight: number; reps: number } | null;
  est1RM?: number | null;
  volumes: { date: string; volume: number }[];
  cardio?: {
    sessions: {
      date: string;
      totalDistance: number;
      totalSeconds: number | null;
    }[];
    maxDistance: number | null;
    fastestPacePerKmSec: number | null; // seconds per km
  };
};

type LastWorkoutItem = {
  name: string;
  sets: number;
  reps?: number;
  totalDistance?: number | null;
  type?: string | null;
};

type LastWorkout = {
  id: string;
  title: string;
  duration_sec: number | null;
  notes?: string | null;
  completed_at: string;
  items: LastWorkoutItem[];
};

type SetJoinRow = {
  reps: number | null;
  weight: number | null;
  distance: number | null;
  workout_exercise_history: {
    workout_history_id: string;
    exercise_id: string;
    exercises: { id: string; name: string; type: string | null };
  };
};

type SetStatsRow = {
  reps: number | null;
  weight: number | null;
  time_seconds: number | null;
  distance: number | null;
  workout_exercise_history: {
    exercise_id: string;
    workout_history: { user_id: string; completed_at: string | null };
    exercises: { id: string; name: string; type: string | null };
  };
};

type ExerciseListRow = {
  exercise_id: string;
  exercises: { id: string; name: string; type: string | null };
  workout_history: { user_id: string; completed_at: string | null };
};

type ExerciseLastTrainedRow = {
  exercise_id: string;
  last_completed_at: string | null;
  exercises: { id: string; name: string; type: string | null };
};

type WorkoutHeaderRow = {
  id: string;
  completed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  workout_title: string | null;
};

// ===== Helpers =====
function fmtDurationMin(sec?: number | null) {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  return `${m}min`;
}

function isCardioType(type?: string | null) {
  if (!type) return false;
  const t = type.toLowerCase();
  return (
    t.includes("cardio") ||
    t.includes("conditioning") ||
    t.includes("endurance") ||
    t.includes("run") ||
    t.includes("row") ||
    t.includes("bike") ||
    t.includes("cycle")
  );
}

function formatDistanceShort(meters: number | null | undefined) {
  if (!meters || meters <= 0) return "—";
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatPace(secPerKm: number | null | undefined) {
  if (!secPerKm || secPerKm <= 0) return "—";
  const totalSec = Math.round(secPerKm);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")} /km`;
}

function formatLastWorkoutLine(it: LastWorkoutItem) {
  const isCardio = isCardioType(it.type);
  if (isCardio) {
    const dist = Math.round(it.totalDistance ?? 0);
    return `${it.name} – ${it.sets} sets · ${dist}m total`;
  }

  // strength / other
  const repsLabel = it.reps != null && it.reps > 0 ? `${it.reps}` : "?";
  return `${it.name} – ${it.sets}x${repsLabel}`;
}

const SCREEN_W = Dimensions.get("window").width;

// --- Shared chart padding & axis styles ---
// Give *plenty* of bottom padding so X-axis labels never get clipped
const CHART_PAD = { left: 64, right: 32, top: 28, bottom: 64 };
const AXIS_LABEL_STYLE = { axisLabel: { padding: 40, fontSize: 12 } };
const AXIS_LABEL_STYLE_Y = { axisLabel: { padding: 54, fontSize: 12 } };

// Integer tick list: 1..n (optionally step k)
function intTicks(n: number, step = 1) {
  const arr: number[] = [];
  for (let i = 1; i <= n; i += step) arr.push(i);
  return arr;
}

function niceBounds(minRaw: number, maxRaw: number, targetTicks = 5) {
  if (!isFinite(minRaw) || !isFinite(maxRaw))
    return { min: 0, max: 1, ticks: [0, 1] };
  if (minRaw === maxRaw) {
    const pad = Math.max(1, Math.abs(minRaw) * 0.1);
    minRaw -= pad;
    maxRaw += pad;
  }
  const span = Math.max(1e-9, maxRaw - minRaw);
  const step0 = span / Math.max(1, targetTicks);
  const pow10 = Math.pow(10, Math.floor(Math.log10(step0)));
  const steps = [1, 2, 2.5, 5, 10].map((m) => m * pow10);
  const step = steps.reduce(
    (best, s) => (Math.abs(s - step0) < Math.abs(best - step0) ? s : best),
    steps[0]
  );
  const min = Math.floor(minRaw / step) * step;
  const max = Math.ceil(maxRaw / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t += step)
    ticks.push(Number(t.toFixed(6)));
  return { min, max, ticks };
}

const CARD_W = Math.min(360, Math.round(Dimensions.get("window").width * 0.8));

// put near top of file
function InfoButton({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: any;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Small info bubble icon */}
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ fontWeight: "800", color: colors.text }}>ⓘ</Text>
      </Pressable>

      {/* Centered modal */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "90%",
              maxWidth: 400,
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: "800",
                  flexShrink: 1,
                }}
              >
                {title}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={{ color: colors.primary, fontWeight: "800" }}>
                  ✕
                </Text>
              </Pressable>
            </View>

            {/* Scrollable info body */}
            <ScrollView style={{ maxHeight: 320 }}>{children}</ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// === Progress Screen =================================================================

export default function ProgressScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // Last 5 workouts
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<LastWorkout[]>([]);

  // Exercise selector + selected exercise stats
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseList, setExerciseList] = useState<
    {
      id: string;
      name: string;
      type: string | null;
      last_completed_at: string | null;
    }[]
  >([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );
  const [selectedExerciseStats, setSelectedExerciseStats] =
    useState<ExerciseStat | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSelected, setLoadingSelected] = useState(true);
  const [selectedExerciseRows, setSelectedExerciseRows] = useState<
    SetStatsRow[]
  >([]);

  // ===== Exercise selector (distinct completed exercises) =====
  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoadingList(true);
      try {
        let q1 = supabase
          .from("v_user_exercise_last_trained")
          .select(
            "exercise_id, last_completed_at, exercises:exercises!inner(id,name,type)"
          )
          .eq("user_id", userId)
          .order("last_completed_at", { ascending: false })
          .limit(300);

        // ⚠️ This may or may not work depending on PostgREST embedding filters.
        // If it errors, do client-side filtering (shown below).
        if (exerciseSearch.trim()) {
          q1 = q1.ilike("exercises.name", `%${exerciseSearch.trim()}%`);
        }

        const { data, error } = await q1.returns<ExerciseLastTrainedRow[]>();
        if (error) throw error;

        // v_user_exercise_last_trained is already distinct → just map
        let list = (data ?? []).map((r) => ({
          id: r.exercises.id,
          name: r.exercises.name,
          type: r.exercises.type,
          last_completed_at: r.last_completed_at,
        }));

        // If embedded ilike doesn't work reliably, fallback to client filter:
        // const term = exerciseSearch.trim().toLowerCase();
        // if (term) list = list.filter(x => x.name.toLowerCase().includes(term));

        setExerciseList(list);

        // Keep selected exercise stable if it still exists
        if (!selectedExerciseId && list.length) {
          setSelectedExerciseId(list[0].id);
        }
      } finally {
        setLoadingList(false);
      }
    })();
  }, [userId, exerciseSearch]); // ✅ no selectedExerciseId here

  // ===== Last 5 workouts (cards) =====
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: wh, error: e1 } = await supabase
          .from("v_user_workout_history_header")
          .select("id, completed_at, duration_seconds, notes, workout_title")
          .eq("user_id", userId)
          .order("completed_at", { ascending: false })
          .limit(5)
          .returns<WorkoutHeaderRow[]>();

        if (e1) throw e1;

        const ids = (wh ?? []).map((r) => r.id);

        let setsQ = supabase
          .from("workout_set_history")
          .select(
            `
    reps,
    weight,
    distance,
    workout_exercise_history:workout_exercise_history!inner(
      workout_history_id,
      exercise_id,
      exercises:exercises!inner(id, name, type)
    )
  `
          )
          .in("workout_exercise_history.workout_history_id", ids);

        const { data: sets, error: e2 } = await setsQ.returns<SetJoinRow[]>();
        if (e2) throw e2;

        // Condense per workout -> exercises list
        const grouped: Record<
          string,
          Record<
            string,
            {
              name: string;
              sets: number;
              reps?: number;
              totalDistance: number;
              type: string | null;
            }
          >
        > = {};

        for (const row of sets ?? []) {
          const hid = row.workout_exercise_history.workout_history_id;
          const exId = row.workout_exercise_history.exercise_id;
          const ex = row.workout_exercise_history.exercises;

          grouped[hid] ||= {};
          if (!grouped[hid][exId]) {
            grouped[hid][exId] = {
              name: ex.name,
              sets: 0,
              reps: undefined,
              totalDistance: 0,
              type: ex.type,
            };
          }

          const acc = grouped[hid][exId];
          acc.sets += 1;

          // keep last seen reps as a rough “x reps” value
          if (row.reps != null) acc.reps = row.reps;

          // accumulate distance for cardio
          if (row.distance != null) {
            acc.totalDistance += Number(row.distance);
          }
        }

        const condensed: Record<string, LastWorkoutItem[]> = Object.fromEntries(
          Object.entries(grouped).map(([hid, dict]) => [
            hid,
            Object.values(dict),
          ])
        );

        const normalized: LastWorkout[] = (wh ?? []).map((r) => ({
          id: r.id,
          title: r.workout_title ?? "Workout", // ✅ FIX
          duration_sec: r.duration_seconds ?? null,
          notes: r.notes ?? null,
          completed_at: r.completed_at,
          items: condensed[r.id] ?? [],
        }));

        setWorkouts(normalized);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ===== Stats for selected exercise only =====
  useEffect(() => {
    if (!userId || !selectedExerciseId) return;
    (async () => {
      setLoadingSelected(true);
      try {
        let q2 = supabase
          .from("workout_set_history")
          .select(
            `
    reps,
    weight,
    time_seconds,
    distance,
    workout_exercise_history:workout_exercise_history!inner(
      exercise_id,
      workout_history:workout_history!inner(user_id, completed_at),
      exercises:exercises!inner(id, name, type)
    )
  `
          )
          .eq("workout_exercise_history.workout_history.user_id", userId)
          .eq("workout_exercise_history.exercise_id", selectedExerciseId)
          .order("completed_at", {
            ascending: false,
            referencedTable: "workout_exercise_history.workout_history",
          })
          .limit(400);

        const { data: rows, error: statsErr } = await q2.returns<
          SetStatsRow[]
        >();
        if (statsErr) throw statsErr;

        setSelectedExerciseRows(rows ?? []);

        // No rows for this exercise
        if (!rows?.length) {
          const sel = exerciseList.find((e) => e.id === selectedExerciseId) || {
            id: selectedExerciseId,
            name: "Exercise",
            type: null as string | null,
            last_completed_at: null as string | null,
          };
          setSelectedExerciseStats({
            exercise: { id: sel.id, name: sel.name, type: sel.type },
            currentWeight: null,
            bestSet: null,
            est1RM: null,
            volumes: [],
          });
          return;
        }

        const meta = rows[0].workout_exercise_history.exercises;
        const isCardio = isCardioType(meta.type);

        const volumesByDay: Record<string, number> = {};
        const cardioByDay: Record<string, { dist: number; secs: number }> = {};

        let latest:
          | { weight?: number | null; created_at?: string | null }
          | undefined;
        let best: { weight: number; reps: number } | null = null;

        for (const r of rows) {
          const completedAt =
            r.workout_exercise_history.workout_history.completed_at;
          const dateKey = completedAt ? completedAt.slice(0, 10) : null;

          if (isCardio) {
            const dist = Number(r.distance ?? 0);
            const secs = Number(r.time_seconds ?? 0);

            if (dateKey) {
              const prev = cardioByDay[dateKey] ?? { dist: 0, secs: 0 };
              prev.dist += dist;
              prev.secs += secs;
              cardioByDay[dateKey] = prev;

              // for the bar chart we store distance as "volume"
              volumesByDay[dateKey] = (volumesByDay[dateKey] ?? 0) + dist;
            }
          } else {
            // existing strength logic
            const vol = (r.weight ?? 0) * (r.reps ?? 0);
            if (dateKey) {
              volumesByDay[dateKey] = (volumesByDay[dateKey] ?? 0) + vol;
            }

            const currTs = latest?.created_at ?? "";
            const ts = completedAt ?? "";
            if (ts > currTs) latest = { weight: r.weight, created_at: ts };

            if (r.weight != null && r.reps != null) {
              const score = r.weight * r.reps;
              const bestScore = best ? best.weight * best.reps : -Infinity;
              if (
                !best ||
                score > bestScore ||
                (score === bestScore && r.weight > best.weight)
              ) {
                best = { weight: r.weight, reps: r.reps };
              }
            }
          }
        }

        // volumes array = distance per session for cardio, kg×reps for strength
        const volumes = Object.entries(volumesByDay)
          .map(([date, volume]) => ({ date, volume }))
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .slice(-8);

        let cardio: ExerciseStat["cardio"] | undefined;
        if (isCardio) {
          const sessions = Object.entries(cardioByDay)
            .map(([date, { dist, secs }]) => ({
              date,
              totalDistance: dist,
              totalSeconds: secs || null,
            }))
            .sort((a, b) => (a.date < b.date ? -1 : 1));

          const maxDistance =
            sessions.length > 0
              ? Math.max(...sessions.map((s) => s.totalDistance))
              : null;

          const paceCandidates = sessions.filter(
            (s) => s.totalDistance >= 1000 && (s.totalSeconds ?? 0) > 0
          );
          const fastestPacePerKmSec =
            paceCandidates.length > 0
              ? Math.min(
                  ...paceCandidates.map(
                    (s) => (s.totalSeconds! * 1000) / s.totalDistance
                  )
                )
              : null;

          cardio = { sessions, maxDistance, fastestPacePerKmSec };
        }

        setSelectedExerciseStats({
          exercise: { id: meta.id, name: meta.name, type: meta.type },
          currentWeight: isCardio ? null : latest?.weight ?? null,
          bestSet: isCardio ? null : best,
          est1RM:
            isCardio || !best
              ? null
              : Math.round(best.weight * (1 + best.reps / 30)),
          volumes,
          cardio,
        });
      } finally {
        setLoadingSelected(false);
      }
    })();
  }, [userId, selectedExerciseId, exerciseList]);

  if (!userId) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Sign in to view progress.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      {/* Header + “Workout History” link */}
      <Pressable
        onPress={() => router.push("../features/workouts/history")}
        style={[s.rowBetween]}
      >
        <Text style={s.h2}>Workout History</Text>
        <Text style={[s.link]}>{workouts.length ? "See all ›" : ""}</Text>
      </Pressable>

      {/* Horizontal carousel (last 5 workouts) */}
      {loading ? (
        <ActivityIndicator />
      ) : workouts.length === 0 ? (
        <Text style={s.muted}>No workouts yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {workouts.map((w) => (
              <Pressable
                key={w.id}
                onPress={() =>
                  router.push({
                    pathname: "../features/workouts/history/detail",
                    params: { id: w.id },
                  })
                }
                style={[s.card, { width: CARD_W }]}
              >
                <View style={[s.rowBetween, { marginBottom: 6 }]}>
                  <Text style={s.muted}>Last Workout</Text>
                  {w.duration_sec ? (
                    <Text style={s.muted}>
                      {fmtDurationMin(w.duration_sec)}
                    </Text>
                  ) : null}
                </View>
                <Text style={s.title}>{w.title}</Text>
                <View style={{ height: 8 }} />
                {w.items.slice(0, 5).map((it, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <View style={s.dot} />
                    <Text style={s.itemText}>{formatLastWorkoutLine(it)}</Text>
                  </View>
                ))}

                {w.notes ? (
                  <>
                    <View style={s.hr} />
                    <Text style={s.subhead}>Workout Notes</Text>
                    <Text style={s.notes} numberOfLines={3}>
                      “{w.notes}”
                    </Text>
                  </>
                ) : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ===== Exercise Selector ===== */}
      <View style={s.card}>
        <Text style={s.h3}>Exercises</Text>
        <TextInput
          value={exerciseSearch}
          onChangeText={setExerciseSearch}
          placeholder="Search exercises…"
          placeholderTextColor={colors.subtle}
          style={[s.input, { marginTop: 8, marginBottom: 8 }]}
        />
        {loadingList ? (
          <ActivityIndicator />
        ) : exerciseList.length === 0 ? (
          <Text style={s.muted}>No completed exercises.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 260 }}>
            {exerciseList.map((ex) => {
              const selected = selectedExerciseId === ex.id;
              return (
                <Pressable
                  key={ex.id}
                  onPress={() => setSelectedExerciseId(ex.id)}
                  style={[
                    s.selectorRow,
                    selected && {
                      backgroundColor: colors.surface,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.selectorTitle,
                        selected && { color: colors.primary },
                      ]}
                    >
                      {ex.name}
                    </Text>
                    <Text style={s.muted}>{ex.type ?? ""}</Text>
                  </View>
                  <Text style={s.muted}>›</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ===== Selected Exercise Stats + Charts ===== */}
      <View style={s.card}>
        {loadingSelected ? (
          <Text style={s.muted}>
            Complete a workout to see exercise stats here.
          </Text>
        ) : !selectedExerciseStats ? (
          <Text style={s.muted}>Select an exercise to see details.</Text>
        ) : (
          <ExerciseStatCard stat={selectedExerciseStats} colors={colors} />
        )}

        {selectedExerciseStats &&
          (isCardioType(selectedExerciseStats.exercise.type) ? (
            <CardioPaceOverTime
              cardio={selectedExerciseStats.cardio}
              colors={colors}
            />
          ) : (
            <>
              <TimeSeriesWithForecast
                volumes={selectedExerciseStats.volumes}
                rows={selectedExerciseRows}
                colors={colors}
              />
              <ScatterIso1RM rows={selectedExerciseRows} colors={colors} />
              <WaterfallSets rows={selectedExerciseRows} colors={colors} />
            </>
          ))}
      </View>
    </ScrollView>
  );
}

// --- chart helpers ---
type XY = { x: number; y: number };
function linearRegression(points: XY[]) {
  const n = points.length;
  if (n < 2) return { m: 0, b: points[0]?.y ?? 0 };
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }
  const m = (n * sumXY - sumX * sumY) / Math.max(1e-9, n * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / n;
  return { m, b };
}
function dateKeyToDayOffset(keys: string[]) {
  // keys are 'YYYY-MM-DD'
  if (!keys.length)
    return { toXY: (_k: string, _y: number) => ({ x: 0, y: 0 }), zero: 0 };
  const t0 = new Date(keys[0]).getTime();
  const day = 86400000;
  return {
    toXY: (k: string, y: number) => ({
      x: Math.round((new Date(k).getTime() - t0) / day),
      y,
    }),
    zero: 0,
  };
}
function epley1RM(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

function TimeSeriesWithForecast({
  rows,
  colors,
}: {
  volumes: { date: string; volume: number }[];
  rows: SetStatsRow[];
  colors: any;
}) {
  const DAY = 86400000;

  // ---- Build per-session best weight & best 1RM (by date) ----
  const byDay = new Map<string, { topW: number; best1RM: number }>();

  for (const r of rows) {
    const completedAt =
      r.workout_exercise_history.workout_history.completed_at ?? null;
    const d = completedAt ? completedAt.slice(0, 10) : null;
    if (!d || r.weight == null || r.reps == null) continue;

    const w = Number(r.weight);
    const reps = Number(r.reps);
    const oneRM = epley1RM(w, reps);

    const prev = byDay.get(d);
    const topW = Math.max(prev?.topW ?? 0, w);
    const best1RM = Math.max(prev?.best1RM ?? 0, oneRM);
    byDay.set(d, { topW, best1RM });
  }

  const allDays = Array.from(byDay.keys()).sort(); // oldest -> newest
  if (!allDays.length) {
    return (
      <Text style={{ color: colors.subtle, marginTop: 8 }}>
        No session history.
      </Text>
    );
  }

  // ---- Hybrid window: last 40 days, but if < 4 sessions then last 8 sessions ----
  const now = new Date();
  const windowStart = new Date(now.getTime() - 40 * DAY);
  const windowEnd = new Date(now.getTime() + 20 * DAY);

  const inLast40 = allDays.filter((d) => new Date(d) >= windowStart);

  const MIN_IN_40 = 4;
  const FALLBACK_LAST_N = 8;

  const days =
    inLast40.length >= MIN_IN_40
      ? inLast40
      : allDays.slice(Math.max(0, allDays.length - FALLBACK_LAST_N));

  // ---- Series for Victory (Date on X) ----
  const weightSeries = days.map((d) => ({
    x: new Date(d),
    y: byDay.get(d)!.topW,
  }));

  const rmSeries = days.map((d) => ({
    x: new Date(d),
    y: Math.round(byDay.get(d)!.best1RM),
  }));

  // ---- Regression needs numeric X (day offsets from first included day) ----
  const firstT = new Date(days[0]).getTime();
  const toXY = (d: string, y: number) => ({
    x: Math.round((new Date(d).getTime() - firstT) / DAY),
    y,
  });

  const weightXY = days.map((d) => toXY(d, byDay.get(d)!.topW));
  const rmXY = days.map((d) => toXY(d, Math.round(byDay.get(d)!.best1RM)));

  const wFit = linearRegression(weightXY);
  const rmFit = linearRegression(rmXY);

  // Last observed x (in day-offset)
  const lastDayOffset = weightXY.length ? weightXY[weightXY.length - 1].x : 0;

  // Forecast end = +20 days from today (in same offset space)
  const futureEndOffset = Math.round((windowEnd.getTime() - firstT) / DAY);
  const fx1 = lastDayOffset;
  const fx2 = Math.max(lastDayOffset + 1, futureEndOffset);

  const forecastW =
    weightXY.length > 0
      ? [
          { x: new Date(firstT + fx1 * DAY), y: wFit.m * fx1 + wFit.b },
          { x: new Date(firstT + fx2 * DAY), y: wFit.m * fx2 + wFit.b },
        ]
      : [];

  const forecastRM =
    rmXY.length > 0
      ? [
          { x: new Date(firstT + fx1 * DAY), y: rmFit.m * fx1 + rmFit.b },
          { x: new Date(firstT + fx2 * DAY), y: rmFit.m * fx2 + rmFit.b },
        ]
      : [];

  // ---- Y bounds ----
  const allY = [
    ...weightSeries.map((p) => p.y),
    ...rmSeries.map((p) => p.y),
    ...forecastW.map((p) => p.y),
    ...forecastRM.map((p) => p.y),
  ].filter((v) => Number.isFinite(v));

  const yN = niceBounds(Math.min(...allY), Math.max(...allY), 6);

  // ---- Ticks every 10 days across fixed window ----
  const xTicks: Date[] = [];
  for (let t = windowStart.getTime(); t <= windowEnd.getTime(); t += 10 * DAY) {
    xTicks.push(new Date(t));
  }

  return (
    <View style={{ marginTop: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          Weight & Est. 1RM (40d view + forecast)
        </Text>
        <InfoButton title="Weight & Est. 1RM" colors={colors}>
          <Text style={{ color: colors.text }}>
            Shows your heaviest set per session and estimated 1RM (Epley).
            Forecast extrapolates the recent trend forward.
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Hybrid window
          </Text>
          <Text style={{ color: colors.text }}>
            Uses last 40 days. If you trained fewer than {MIN_IN_40} times in
            that window, it falls back to your last {FALLBACK_LAST_N} sessions.
          </Text>
        </InfoButton>
      </View>

      <VictoryChart
        width={SCREEN_W - 32}
        theme={themeMaterial}
        height={240}
        padding={{ left: 56, right: 32, top: 24, bottom: 64 }}
        domain={{ x: [windowStart, windowEnd], y: [yN.min, yN.max] }}
      >
        <VictoryAxis
          label="Date"
          tickValues={xTicks}
          tickFormat={(d: Date) =>
            d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
          }
          style={{
            axisLabel: {
              padding: 40,
              fill: colors.text,
              fontSize: 12,
              fontWeight: "700",
            },
            tickLabels: { fill: colors.subtle, fontSize: 10 },
            grid: {
              stroke: colors.border,
              strokeDasharray: "4,4",
              opacity: 0.5,
            },
          }}
        />

        <VictoryAxis
          dependentAxis
          label="Kg"
          tickValues={yN.ticks}
          tickFormat={(t: number) => `${Math.round(t)}`}
          style={{
            axisLabel: {
              padding: 40,
              fill: colors.text,
              fontSize: 12,
              fontWeight: "700",
            },
            tickLabels: { fill: colors.subtle, fontSize: 10 },
            grid: {
              stroke: colors.border,
              strokeDasharray: "4,4",
              opacity: 0.6,
            },
          }}
        />

        <VictoryLegend
          x={0}
          y={0}
          orientation="horizontal"
          gutter={16}
          data={[
            { name: "Top Weight", symbol: { fill: colors.primary } },
            { name: "Est. 1RM", symbol: { fill: colors.warning ?? "#f59e0b" } },
            { name: "Forecast", symbol: { fill: colors.text } },
          ]}
          style={{ labels: { fill: colors.text, fontSize: 10 } }}
        />

        <VictoryGroup>
          <VictoryLine
            data={weightSeries}
            style={{ data: { stroke: colors.primary, strokeWidth: 3 } }}
          />
          <VictoryLine
            data={rmSeries}
            style={{
              data: { stroke: colors.warning ?? "#f59e0b", strokeWidth: 3 },
            }}
          />
          <VictoryLine
            data={forecastW}
            style={{
              data: {
                stroke: colors.text,
                strokeDasharray: "6,4",
                strokeWidth: 2,
                opacity: 0.8,
              },
            }}
          />
          <VictoryLine
            data={forecastRM}
            style={{
              data: {
                stroke: colors.text,
                strokeDasharray: "6,4",
                strokeWidth: 2,
                opacity: 0.8,
              },
            }}
          />
        </VictoryGroup>
      </VictoryChart>
    </View>
  );
}

// 3.2 Scatter (weight vs reps) with iso-1RM curves
function ScatterIso1RM({ rows, colors }: { rows: SetStatsRow[]; colors: any }) {
  const pts = rows
    .filter((r) => r.weight != null && r.reps != null)
    .map((r) => ({ x: Number(r.reps), y: Number(r.weight) }));

  if (!pts.length) {
    return (
      <Text style={{ color: colors.subtle, marginTop: 8 }}>
        No sets recorded yet.
      </Text>
    );
  }

  const minW = Math.min(...pts.map((p) => p.y));
  const maxW = Math.max(...pts.map((p) => p.y));
  const yN = niceBounds(minW, maxW, 6);
  const maxReps = Math.max(15, Math.max(...pts.map((p) => p.x)));

  const ests = rows
    .filter((r) => r.weight != null && r.reps != null)
    .map((r) => epley1RM(Number(r.weight), Number(r.reps)));

  const minRM = Math.floor(Math.min(...ests));
  const maxRM = Math.ceil(Math.max(...ests));
  const step = Math.max(5, Math.round((maxRM - minRM) / 4));

  type Curve = { rm: number; curve: { x: number; y: number }[] };
  const curves: Curve[] = [];

  for (let rm = minRM; rm <= maxRM; rm += step) {
    const curve: { x: number; y: number }[] = [];
    for (let reps = 1; reps <= 15; reps++) {
      const w = rm / (1 + reps / 30);
      curve.push({ x: reps, y: w });
    }
    curves.push({ rm, curve });
  }

  // points where we'll place the "XXX 1RM" labels (right end of each curve)
  const labelPoints = curves.map((c) => {
    const last = c.curve[c.curve.length - 1]; // x = 15
    return { x: last.x, y: last.y, rm: c.rm };
  });

  return (
    <View style={{ marginTop: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          Weight vs Reps (iso-1RM curves)
        </Text>
        <InfoButton title="Weight vs Reps" colors={colors}>
          <Text style={{ color: colors.text }}>
            Each dot is a set (reps on X, weight on Y). Dashed lines are iso-1RM
            curves — points on the same line have the same estimated 1RM.
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            What to look for
          </Text>
          <Text style={{ color: colors.text }}>
            • New dots on higher curves → stronger 1RM.{"\n"}• More reps at same
            weight → endurance gain.{"\n"}• Heavier weight at same reps →
            strength gain.
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Example of a useful graph
          </Text>
          <Text style={{ color: colors.text }}>
            Recent points shifting up and left (heavier at similar reps).
          </Text>
        </InfoButton>
      </View>

      <VictoryChart
        width={SCREEN_W - 32}
        theme={themeMaterial}
        height={240}
        // extra bottom padding so "Reps" label isn't clipped
        padding={{ ...CHART_PAD, bottom: 56 }}
        domain={{ x: [1, maxReps], y: [yN.min, yN.max] }}
      >
        <VictoryAxis
          label="Reps"
          style={{
            axisLabel: {
              ...(AXIS_LABEL_STYLE.axisLabel as any),
              fill: colors.text,
              fontSize: 12,
              fontWeight: "700",
            },
            tickLabels: { fill: colors.subtle, fontSize: 10 },
            grid: {
              stroke: colors.border,
              strokeDasharray: "4,4",
              opacity: 0.5,
            },
          }}
          tickValues={intTicks(maxReps, maxReps > 12 ? 2 : 1)}
          tickFormat={(t: number) => `${t | 0}`}
        />
        <VictoryAxis
          dependentAxis
          label="Kg"
          style={{
            axisLabel: {
              ...(AXIS_LABEL_STYLE_Y.axisLabel as any),
              fill: colors.text,
              fontSize: 12,
              fontWeight: "700",
            },
            tickLabels: { fill: colors.subtle, fontSize: 10 },
            grid: {
              stroke: colors.border,
              strokeDasharray: "4,4",
              opacity: 0.6,
            },
          }}
          tickValues={yN.ticks}
          tickFormat={(t: number) => `${Math.round(t)}`}
        />

        {/* iso-1RM curves */}
        {curves.map((c, i) => (
          <VictoryLine
            key={i}
            data={c.curve}
            style={{
              data: {
                stroke: colors.text,
                strokeDasharray: "4,4",
                opacity: 0.35, // visible in light & dark
              },
            }}
          />
        ))}

        {/* 1RM labels at the end of each curve */}
        <VictoryScatter
          data={labelPoints}
          size={3}
          style={{
            data: { fill: "transparent" }, // invisible dots, labels only
          }}
          labels={({ datum }: any) => `${datum.rm.toFixed(0)} 1RM`}
          labelComponent={
            <VictoryLabel
              dx={4} // nudge right
              dy={-4} // nudge up
              style={{
                fill: colors.text,
                fontSize: 9,
                fontWeight: "600",
              }}
            />
          }
        />

        {/* actual sets */}
        <VictoryScatter
          data={pts}
          size={4}
          style={{ data: { fill: colors.primary } }}
        />
      </VictoryChart>
    </View>
  );
}

// 3.3 Waterfall: per-set volume for most recent session
function WaterfallSets({ rows, colors }: { rows: SetStatsRow[]; colors: any }) {
  // group rows by date; pick latest date
  const byDate = new Map<string, SetStatsRow[]>();
  for (const r of rows) {
    const d = r.workout_exercise_history.workout_history.completed_at?.slice(
      0,
      10
    );
    if (!d) continue;
    byDate.set(d, [...(byDate.get(d) ?? []), r]);
  }
  const latest = Array.from(byDate.keys()).sort().pop();
  if (!latest)
    return (
      <Text style={{ color: colors.subtle, marginTop: 8 }}>
        No session to display.
      </Text>
    );

  const session = byDate
    .get(latest)!
    .filter((r) => r.weight != null && r.reps != null);

  const setVolumes = session.map((r, idx) => ({
    idx: idx + 1,
    vol: Number(r.weight) * Number(r.reps),
  }));

  let cum = 0;
  const bars = setVolumes.map((s) => {
    const y0 = cum;
    cum += s.vol;
    return { x: s.idx, y: cum, y0, label: `${s.vol.toFixed(0)}` };
  });

  const n = session.length;
  const cumMax = bars.length ? bars[bars.length - 1].y : 0;
  const yN = niceBounds(0, cumMax, 6);

  // ensure bars are fully inside the frame
  const xMin = 0.5;
  const xMax = Math.max(1, n) + 0.5;

  return (
    <View style={{ marginTop: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          Waterfall — {latest} (set volume contributions)
        </Text>
        <InfoButton title="Waterfall (Session Volume)" colors={colors}>
          <Text style={{ color: colors.text }}>
            Bars show how each set contributes to cumulative volume (weight ×
            reps).
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            What to look for
          </Text>
          <Text style={{ color: colors.text }}>
            • Consistent bar sizes → steady effort.{"\n"}• Early huge bars →
            front-loaded work; later fatigue may be high.{"\n"}• Tiny final bars
            → consider stopping before junk volume.
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Example of a useful graph
          </Text>
          <Text style={{ color: colors.text }}>
            Bars that step up smoothly across 4–6 sets.
          </Text>
        </InfoButton>
      </View>

      <VictoryChart
        width={SCREEN_W - 32}
        theme={themeMaterial}
        height={220}
        padding={{ ...CHART_PAD, bottom: 56 }}
        domain={{ x: [xMin, xMax], y: [yN.min, yN.max] }}
      >
        <VictoryAxis
          label="Set #"
          style={{
            axisLabel: {
              ...(AXIS_LABEL_STYLE.axisLabel as any),
              fill: colors.text,
              fontSize: 12,
              fontWeight: "700",
            },
            tickLabels: { fill: colors.subtle, fontSize: 10 },
          }}
          tickValues={intTicks(n, n > 10 ? 2 : 1)}
          tickFormat={(t: number) => `${t | 0}`}
        />
        <VictoryAxis
          dependentAxis
          label="Cumulative Volume"
          style={{
            axisLabel: {
              ...(AXIS_LABEL_STYLE_Y.axisLabel as any),
              fill: colors.text,
              fontSize: 12,
              fontWeight: "700",
            },
            tickLabels: { fill: colors.subtle, fontSize: 10 },
          }}
          tickValues={yN.ticks}
          tickFormat={(t: number) => `${Math.round(t)}`}
        />

        <VictoryBar
          data={bars}
          x="x"
          y="y"
          y0={(d: any) => (d as any).y0}
          barRatio={0.6} // slightly narrower so they sit nicely inside the domain
          labels={({ datum }: { datum: any }) => datum.label as string}
          style={{
            data: { fill: colors.primary, opacity: 0.9 },
            labels: { fill: colors.text, fontSize: 11, fontWeight: "600" },
          }}
        />
      </VictoryChart>
    </View>
  );
}

{
  /* 
// 3.4 Histograms: weights & reps
function Histograms({ rows, colors }: { rows: SetStatsRow[]; colors: any }) {
  const weights = rows
    .filter((r) => r.weight != null)
    .map((r) => Number(r.weight));
  const reps = rows.filter((r) => r.reps != null).map((r) => Number(r.reps));
  if (!weights.length && !reps.length)
    return (
      <Text style={{ color: colors.subtle, marginTop: 8 }}>
        No distribution yet.
      </Text>
    );

  const w = makeBins(weights, 2.5); // 2.5kg bins
  const r = makeBins(reps, 1); // 1-rep bins
  const yW = niceBounds(0, Math.max(1, ...w.bins.map((b) => b.y)), 5);
  const yR = niceBounds(0, Math.max(1, ...r.bins.map((b) => b.y)), 5);

  return (
    <View style={{ marginTop: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          Distributions — Working Weights & Reps
        </Text>
        <InfoButton title="Distributions" colors={colors}>
          <Text style={{ color: colors.text }}>
            Histograms of all recorded set weights and reps for this exercise.
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            What to look for
          </Text>
          <Text style={{ color: colors.text }}>
            • Weight peaks shifting right over time → progressive overload.
            {"\n"}• Reps peak matches your intended rep range (e.g., 5–8 or
            8–12).{"\n"}• Very wide spread → inconsistent loading.
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Example of a useful graph
          </Text>
          <Text style={{ color: colors.text }}>
            Weight histogram with a clear peak near your current top sets and a
            smaller tail above it.
          </Text>
        </InfoButton>
      </View>

      <VictoryChart
        width={SCREEN_W - 32}
        theme={themeMaterial}
        height={220}
        padding={CHART_PAD}
        domain={{ x: [w.xN.min, w.xN.max], y: [yW.min, yW.max] }}
      >
        <VictoryAxis
          label="Weight (kg)"
          style={{
            ...AXIS_LABEL_STYLE,
            tickLabels: { fill: colors.subtle, fontSize: 10 },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickValues={yW.ticks}
          style={{
            ...AXIS_LABEL_STYLE_Y,
            tickLabels: { fill: colors.subtle, fontSize: 10 },
          }}
        />
        <VictoryBar
          data={w.bins}
          x="x"
          y="y"
          style={{ data: { fill: colors.primary, opacity: 0.9 } }}
        />
      </VictoryChart>

      <VictoryChart
        width={SCREEN_W - 32}
        theme={themeMaterial}
        height={220}
        padding={CHART_PAD}
        domain={{ x: [r.xN.min, r.xN.max], y: [yR.min, yR.max] }}
      >
        <VictoryAxis
          label="Reps"
          style={{
            ...AXIS_LABEL_STYLE,
            tickLabels: { fill: colors.subtle, fontSize: 10 },
          }}
          tickValues={intTicks(r.xN.max, 1)}
        />
        <VictoryAxis
          dependentAxis
          tickValues={yR.ticks}
          style={{
            ...AXIS_LABEL_STYLE_Y,
            tickLabels: { fill: colors.subtle, fontSize: 10 },
          }}
        />
        <VictoryBar
          data={r.bins}
          x="x"
          y="y"
          style={{ data: { fill: colors.primary, opacity: 0.9 } }}
        />
      </VictoryChart>
    </View>
  );
}
  */
}

function CardioPaceOverTime({
  cardio,
  colors,
}: {
  cardio: ExerciseStat["cardio"] | undefined;
  colors: any;
}) {
  if (!cardio || !cardio.sessions.length) {
    return (
      <Text style={{ color: colors.subtle, marginTop: 8 }}>
        No cardio pace data yet.
      </Text>
    );
  }

  const points = cardio.sessions
    .map((s, idx) => {
      if (!s.totalSeconds || s.totalSeconds <= 0 || s.totalDistance <= 0)
        return null;
      const secPerKm = (s.totalSeconds * 1000) / s.totalDistance;
      return {
        x: idx + 1, // session index
        y: secPerKm,
        label: s.date,
      };
    })
    .filter((p): p is { x: number; y: number; label: string } => p !== null);

  if (!points.length) {
    return (
      <Text style={{ color: colors.subtle, marginTop: 8 }}>
        No valid pace samples yet.
      </Text>
    );
  }

  const yVals = points.map((p) => p.y);
  const yN = niceBounds(Math.min(...yVals), Math.max(...yVals), 5);

  return (
    <View style={{ marginTop: 16 }}>
      {/* header row with info bubble */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          Pace over time (min/km)
        </Text>
        <InfoButton title="Pace over time" colors={colors}>
          <Text style={{ color: colors.text }}>
            Each point is one cardio session. Pace is the average minutes per
            kilometre for that workout.
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            What to look for
          </Text>
          <Text style={{ color: colors.text }}>
            • Points trending down → you’re getting faster.{"\n"}• Flat line →
            pace is stable.{"\n"}• Large jumps up → unusually slow / recovery
            sessions.
          </Text>
          <View style={{ height: 8 }} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>Example</Text>
          <Text style={{ color: colors.text }}>
            Over a few weeks, a steady drop from ~6:00/km towards ~5:30/km.
          </Text>
        </InfoButton>
      </View>

      <VictoryChart
        width={SCREEN_W - 32}
        theme={themeMaterial}
        height={240}
        padding={{ left: 64, right: 32, top: 24, bottom: 64 }}
        domain={{ x: [1, points.length], y: [yN.min, yN.max] }}
      >
        <VictoryAxis
          label="Session"
          style={{
            axisLabel: {
              padding: 40,
              fill: colors.text,
              fontSize: 12,
              fontWeight: "700",
            },
            tickLabels: { fill: colors.subtle, fontSize: 10 },
          }}
        />
        <VictoryAxis
          dependentAxis
          label="Pace"
          tickValues={yN.ticks}
          tickFormat={(t: number) => formatPace(t)}
          style={{
            axisLabel: {
              padding: 48,
              fill: colors.text,
              fontSize: 12,
              fontWeight: "700",
              dy: -8,
            },
            tickLabels: { fill: colors.subtle, fontSize: 10 },
          }}
        />

        <VictoryLine
          data={points}
          style={{
            data: {
              stroke: colors.primary,
              strokeWidth: 3,
            },
          }}
        />
        <VictoryScatter
          data={points}
          size={4}
          style={{ data: { fill: colors.primary } }}
        />
      </VictoryChart>
    </View>
  );
}

function ExerciseStatCard({
  stat,
  colors,
}: {
  stat: ExerciseStat;
  colors: any;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isCardio = isCardioType(stat.exercise.type);
  const cardio = stat.cardio;

  // Bars: last few sessions (distance for cardio, volume for strength)
  const series =
    (isCardio
      ? cardio?.sessions?.map((s) => ({
          date: s.date,
          value: s.totalDistance,
        }))
      : stat.volumes.map((v) => ({ date: v.date, value: v.volume }))) ?? [];

  const lastBars = series.slice(-8);

  return (
    <View style={[s.subcard]}>
      <Text style={s.titleSm}>{stat.exercise.name}</Text>

      {/* KPIs */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        {isCardio ? (
          <>
            <View style={[s.kpi]}>
              <Text style={s.kpiLabel}>Farthest Distance</Text>
              <Text style={s.kpiValue}>
                {formatDistanceShort(cardio?.maxDistance ?? null)}
              </Text>
            </View>
            <View style={[s.kpi]}>
              <Text style={s.kpiLabel}>Fastest Pace</Text>
              <Text
                style={[s.kpiValue, { color: colors.success ?? "#22c55e" }]}
              >
                {formatPace(cardio?.fastestPacePerKmSec ?? null)}
              </Text>
            </View>
            <View style={[s.kpi]}>
              <Text style={s.kpiLabel}>Sessions Tracked</Text>
              <Text style={s.kpiValue}>{cardio?.sessions?.length ?? 0}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={[s.kpi]}>
              <Text style={s.kpiLabel}>Current Weight</Text>
              <Text style={s.kpiValue}>
                {stat.currentWeight != null ? `${stat.currentWeight}kg` : "—"}
              </Text>
            </View>
            <View style={[s.kpi]}>
              <Text style={s.kpiLabel}>Best Set</Text>
              <Text
                style={[s.kpiValue, { color: colors.success ?? "#22c55e" }]}
              >
                {stat.bestSet
                  ? `${stat.bestSet.weight}kg × ${stat.bestSet.reps}`
                  : "—"}
              </Text>
            </View>
            <View style={[s.kpi]}>
              <Text style={s.kpiLabel}>Est. 1RM</Text>
              <Text
                style={[s.kpiValue, { color: colors.warning ?? "#f59e0b" }]}
              >
                {stat.est1RM != null ? `${stat.est1RM}kg` : "—"}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Mini bar chart */}
      <View style={{ marginTop: 12 }}>
        <Text style={s.muted}>
          {isCardio
            ? "Distance per session (recent)"
            : "Training volume across recent sessions"}
        </Text>

        <View
          style={{
            height: 160,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
            marginTop: 8,
            paddingHorizontal: 6,
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          {lastBars.length === 0 ? (
            <Text style={[s.muted, { padding: 8 }]}>No data yet</Text>
          ) : (
            lastBars.slice(-7).map((v, _i, arr) => {
              const max = Math.max(...arr.map((a) => a.value));
              const h = max > 0 ? Math.round((v.value / max) * 120) : 0;

              const label = isCardio
                ? formatDistanceShort(v.value)
                : v.value >= 1000
                ? `${(v.value / 1000).toFixed(1)}k`
                : v.value.toFixed(0);

              return (
                <View key={v.date} style={{ alignItems: "center" }}>
                  <Text style={[s.muted, { fontSize: 11, marginBottom: 4 }]}>
                    {label}
                  </Text>

                  <View
                    style={{
                      width: 28,
                      height: h,
                      borderRadius: 6,
                      backgroundColor: colors.primary,
                    }}
                  />

                  <Text style={[s.muted, { marginTop: 4, fontSize: 12 }]}>
                    {new Date(v.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </View>
    </View>
  );
}

// ===== Styles =====
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    h2: { fontSize: 20, fontWeight: "800", color: colors.text },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    link: { color: colors.primary, fontWeight: "700" },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subcard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    titleSm: { fontSize: 16, fontWeight: "800", color: colors.text },
    itemText: { color: colors.text },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: 8,
    },
    subhead: {
      color: colors.text,
      fontWeight: "700",
      marginTop: 6,
      marginBottom: 4,
    },
    notes: { color: colors.subtle, fontStyle: "italic" },
    hr: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    muted: { color: colors.subtle },
    kpi: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    kpiLabel: { color: colors.subtle, fontSize: 12, marginBottom: 4 },
    kpiValue: { color: colors.text, fontWeight: "800", fontSize: 18 },
    selectorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 8,
    },
    selectorTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  });
