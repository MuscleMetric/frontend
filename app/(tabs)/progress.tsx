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
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
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
const VictoryHistogram = undefined;
const themeMaterial = V?.VictoryTheme?.material ?? undefined;

// (optional) one-time sanity log
console.log(
  "victory-native keys:",
  Object.keys(V || {}),
  "default:",
  Object.keys(V?.default || {})
);

// ===== Types =====
type LastWorkout = {
  id: string;
  title: string;
  duration_sec: number | null;
  notes?: string | null;
  completed_at: string;
  items: { name: string; sets: number; reps?: number }[];
};

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
};

type WorkoutHistoryRow = {
  id: string;
  completed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  workouts: { id: string; title: string | null } | null;
};

type SetJoinRow = {
  reps: number | null;
  weight: number | null;
  workout_exercise_history: {
    workout_history_id: string;
    exercise_id: string;
    exercises: { id: string; name: string };
  };
};

type SetStatsRow = {
  reps: number | null;
  weight: number | null;
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

// ===== Helpers =====
function fmtDurationMin(sec?: number | null) {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  return `${m}min`;
}
const CARD_W = Math.min(360, Math.round(Dimensions.get("window").width * 0.8));

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
          .from("workout_exercise_history")
          .select(
            `
            exercise_id,
            exercises:exercises!inner(id, name, type),
            workout_history:workout_history!inner(user_id, completed_at)
          `
          )
          .eq("workout_history.user_id", userId)
          .order("completed_at", {
            ascending: false,
            referencedTable: "workout_history",
          })
          .limit(2000);

        if (exerciseSearch.trim()) {
          q1 = q1.ilike("exercises.name", `%${exerciseSearch.trim()}%`);
        }

        const { data, error } = await q1.returns<ExerciseListRow[]>();
        if (error) throw error;

        // Distinct by exercise, keep most recent completion
        const map = new Map<
          string,
          {
            id: string;
            name: string;
            type: string | null;
            last_completed_at: string | null;
          }
        >();
        for (const r of data ?? []) {
          const ex = r.exercises;
          const completedAt = r.workout_history.completed_at;
          const prev = map.get(ex.id);
          if (!prev || (completedAt ?? "") > (prev.last_completed_at ?? "")) {
            map.set(ex.id, {
              id: ex.id,
              name: ex.name,
              type: ex.type,
              last_completed_at: completedAt ?? null,
            });
          }
        }
        const list = Array.from(map.values()).sort((a, b) =>
          (b.last_completed_at ?? "") < (a.last_completed_at ?? "") ? -1 : 1
        );

        setExerciseList(list);
        if (!selectedExerciseId && list.length)
          setSelectedExerciseId(list[0].id);
      } finally {
        setLoadingList(false);
      }
    })();
  }, [userId, exerciseSearch, selectedExerciseId]);

  // ===== Last 5 workouts (cards) =====
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: wh, error: e1 } = await supabase
          .from("workout_history")
          .select(
            `
            id,
            completed_at,
            duration_seconds,
            notes,
            workouts:workouts(id, title)
          `
          )
          .eq("user_id", userId)
          .order("completed_at", { ascending: false })
          .limit(5)
          .returns<WorkoutHistoryRow[]>();
        if (e1) throw e1;

        const ids = (wh ?? []).map((r) => r.id);

        let setsQ = supabase
          .from("workout_set_history")
          .select(
            `
            reps,
            weight,
            workout_exercise_history:workout_exercise_history!inner(
              workout_history_id,
              exercise_id,
              exercises:exercises!inner(id, name)
            )
          `
          )
          .in("workout_exercise_history.workout_history_id", ids);

        const { data: sets, error: e2 } = await setsQ.returns<SetJoinRow[]>();
        if (e2) throw e2;

        // Condense per workout -> exercises list
        const grouped: Record<
          string,
          Record<string, { name: string; sets: number; reps?: number }>
        > = {};
        for (const row of sets ?? []) {
          const hid = row.workout_exercise_history.workout_history_id;
          const exId = row.workout_exercise_history.exercise_id;
          const name = row.workout_exercise_history.exercises.name;

          grouped[hid] ||= {};
          grouped[hid][exId] ||= { name, sets: 0, reps: undefined };
          grouped[hid][exId].sets += 1;
          if (row.reps != null) grouped[hid][exId].reps = row.reps;
        }
        const condensed: Record<
          string,
          { name: string; sets: number; reps?: number }[]
        > = Object.fromEntries(
          Object.entries(grouped).map(([hid, dict]) => [
            hid,
            Object.values(dict),
          ])
        );

        const normalized: LastWorkout[] = (wh ?? []).map((r) => ({
          id: r.id,
          title: r.workouts?.title ?? "Workout",
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
          .limit(1000);

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
        const volumesByDay: Record<string, number> = {};
        let latest:
          | { weight?: number | null; created_at?: string | null }
          | undefined;
        let best: { weight: number; reps: number } | null = null;

        for (const r of rows) {
          const completedAt =
            r.workout_exercise_history.workout_history.completed_at;
          const dateKey = completedAt ? completedAt.slice(0, 10) : null;
          const vol = (r.weight ?? 0) * (r.reps ?? 0);
          if (dateKey)
            volumesByDay[dateKey] = (volumesByDay[dateKey] ?? 0) + vol;

          // latest by completed_at
          const currTs = latest?.created_at ?? "";
          const ts = completedAt ?? "";
          if (ts > currTs) latest = { weight: r.weight, created_at: ts };

          // best by weight*reps (tie-break by higher weight)
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

        const volumes = Object.entries(volumesByDay)
          .map(([date, volume]) => ({ date, volume }))
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .slice(-8);

        setSelectedExerciseStats({
          exercise: { id: meta.id, name: meta.name, type: meta.type },
          currentWeight: latest?.weight ?? null,
          bestSet: best,
          est1RM: best ? Math.round(best.weight * (1 + best.reps / 30)) : null,
          volumes,
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
        onPress={() => router.push("/features/history")}
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
                    pathname: "/features/history/detail",
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
                    <Text style={s.itemText}>
                      {it.name} – {it.sets}x{it.reps ?? "?"}
                    </Text>
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

      {/* ===== Selected Exercise Stats ===== */}
      <View style={s.card}>
        {loadingSelected ? (
          <ActivityIndicator />
        ) : !selectedExerciseStats ? (
          <Text style={s.muted}>Select an exercise to see details.</Text>
        ) : (
          <ExerciseStatCard stat={selectedExerciseStats} colors={colors} />
        )}

        {selectedExerciseStats && (
          <>
            <TimeSeriesWithForecast
              volumes={selectedExerciseStats.volumes}
              rows={selectedExerciseRows}
              colors={colors}
            />
            <ScatterIso1RM rows={selectedExerciseRows} colors={colors} />
            <WaterfallSets rows={selectedExerciseRows} colors={colors} />
            <Histograms rows={selectedExerciseRows} colors={colors} />
          </>
        )}
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
function project(points: XY[], daysAhead = 30): XY[] {
  if (!points.length) return [];
  const baseX = points[0].x;
  const { m, b } = linearRegression(points);
  const lastX = points[points.length - 1].x;
  const targetX = lastX + daysAhead;
  return [
    { x: baseX, y: m * baseX + b },
    { x: targetX, y: m * targetX + b },
  ];
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

// 3.1 Time series with forecast (Weight & Est 1RM)
function TimeSeriesWithForecast({
  rows, // SetStatsRow[] raw
  colors,
}: {
  volumes: { date: string; volume: number }[];
  rows: SetStatsRow[];
  colors: any;
}) {
  // Build per-session best weight & est1RM
  const byDay = new Map<string, { topW?: number; best1RM?: number }>();
  for (const r of rows) {
    const d = r.workout_exercise_history.workout_history.completed_at?.slice(
      0,
      10
    );
    if (!d || r.weight == null || r.reps == null) continue;
    const w = Number(r.weight);
    const reps = Number(r.reps);
    const topW = Math.max(byDay.get(d)?.topW ?? 0, w);
    const oneRM = epley1RM(w, reps);
    const best1RM = Math.max(byDay.get(d)?.best1RM ?? 0, oneRM);
    byDay.set(d, { topW, best1RM });
  }
  const days = Array.from(byDay.keys()).sort();
  if (!days.length)
    return (
      <Text style={{ color: colors.subtle, marginTop: 8 }}>
        No session history.
      </Text>
    );
  const { toXY } = dateKeyToDayOffset(days);

  const weightSeries = days.map((d) => toXY(d, byDay.get(d)!.topW!));
  const rmSeries = days.map((d) => toXY(d, Math.round(byDay.get(d)!.best1RM!)));

  const forecastW = project(weightSeries, 30);
  const forecastRM = project(rmSeries, 30);

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
        Weight & Est. 1RM (with 30-day forecast)
      </Text>
      <VictoryChart
        theme={themeMaterial}
        height={220}
        padding={{ left: 48, right: 24, top: 24, bottom: 36 }}
      >
        <VictoryAxis label="Days" style={{ axisLabel: { padding: 28 } }} />
        <VictoryAxis
          dependentAxis
          label="Kg"
          style={{ axisLabel: { padding: 40 } }}
        />
        <VictoryLegend
          x={0}
          y={0}
          orientation="horizontal"
          gutter={16}
          data={[
            { name: "Top Weight", symbol: { fill: colors.primary } },
            { name: "Est. 1RM", symbol: { fill: colors.warning ?? "#f39c12" } },
            { name: "Forecast", symbol: { fill: colors.subtle } },
          ]}
        />
        <VictoryGroup>
          <VictoryLine
            data={weightSeries}
            style={{ data: { stroke: colors.primary } }}
          />
          <VictoryLine
            data={rmSeries}
            style={{ data: { stroke: colors.warning ?? "#f39c12" } }}
          />
          <VictoryLine
            data={forecastW}
            style={{ data: { stroke: colors.subtle, strokeDasharray: "6,4" } }}
          />
          <VictoryLine
            data={forecastRM}
            style={{ data: { stroke: colors.subtle, strokeDasharray: "6,4" } }}
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
  if (!pts.length)
    return (
      <Text style={{ color: colors.subtle, marginTop: 8 }}>
        No set data for scatter.
      </Text>
    );

  // pick iso-1RM curves from data range
  const ests = rows
    .filter((r) => r.weight != null && r.reps != null)
    .map((r) => epley1RM(Number(r.weight), Number(r.reps)));
  const minRM = Math.floor(Math.min(...ests));
  const maxRM = Math.ceil(Math.max(...ests));
  const step = Math.max(5, Math.round((maxRM - minRM) / 4));
  const curves = [];
  for (let rm = minRM; rm <= maxRM; rm += step) {
    const curve = [];
    for (let reps = 1; reps <= 15; reps++) {
      const w = rm / (1 + reps / 30);
      curve.push({ x: reps, y: w });
    }
    curves.push({ rm, curve });
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
        Weight vs Reps (iso-1RM curves)
      </Text>
      <VictoryChart
        theme={themeMaterial}
        height={240}
        padding={{ left: 48, right: 24, top: 24, bottom: 36 }}
      >
        <VictoryAxis
          label="Reps"
          style={{ axisLabel: { padding: 28 } }}
          tickFormat={(t: number | string) => `${t}`}
        />
        <VictoryAxis
          dependentAxis
          label="Kg"
          style={{ axisLabel: { padding: 40 } }}
        />
        {curves.map((c, i) => (
          <VictoryLine
            key={i}
            data={c.curve}
            style={{
              data: {
                stroke: colors.subtle,
                strokeDasharray: "4,4",
                opacity: 0.7,
              },
            }}
            labels={({ datum }: { datum: any }) =>
              datum.x === 10 ? `${c.rm.toFixed(0)} 1RM` : ""
            }
            labelComponent={<VictoryLabel dy={-6} />}
          />
        ))}
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

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
        Waterfall — {latest} (set volume contributions)
      </Text>
      <VictoryChart
        theme={themeMaterial}
        height={220}
        padding={{ left: 52, right: 24, top: 24, bottom: 36 }}
      >
        <VictoryAxis label="Set #" style={{ axisLabel: { padding: 28 } }} />
        <VictoryAxis
          dependentAxis
          label="Cumulative Volume"
          style={{ axisLabel: { padding: 44 } }}
        />
        <VictoryBar
          data={bars} // [{ x, y, y0, label }]
          x="x"
          y="y"
          y0={(datum: any) => (datum as any).y0}
          labels={({ datum }: { datum: any }) => datum.label as string}
          style={{ data: { fill: colors.primary, opacity: 0.85 } }}
        />
      </VictoryChart>
    </View>
  );
}

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
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
        Distributions — Working Weights & Reps
      </Text>
      <VictoryChart
        theme={themeMaterial}
        height={220}
        padding={{ left: 48, right: 24, top: 24, bottom: 36 }}
      >
        <VictoryAxis
          label="Weight (kg)"
          style={{ axisLabel: { padding: 28 } }}
        />
        <VictoryAxis dependentAxis />
      </VictoryChart>

      <VictoryChart
        theme={themeMaterial}
        height={220}
        padding={{ left: 48, right: 24, top: 24, bottom: 36 }}
      >
        <VictoryAxis label="Reps" style={{ axisLabel: { padding: 28 } }} />
        <VictoryAxis dependentAxis />
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
  return (
    <View style={[s.subcard]}>
      <Text style={s.titleSm}>{stat.exercise.name}</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <View style={[s.kpi]}>
          <Text style={s.kpiLabel}>Current Weight</Text>
          <Text style={s.kpiValue}>
            {stat.currentWeight != null ? `${stat.currentWeight}kg` : "—"}
          </Text>
        </View>
        <View style={[s.kpi]}>
          <Text style={s.kpiLabel}>Best Set</Text>
          <Text style={[s.kpiValue, { color: colors.success ?? "#2ecc71" }]}>
            {stat.bestSet
              ? `${stat.bestSet.weight}kg × ${stat.bestSet.reps}`
              : "—"}
          </Text>
        </View>
        <View style={[s.kpi]}>
          <Text style={s.kpiLabel}>Est. 1RM</Text>
          <Text style={[s.kpiValue, { color: colors.warning ?? "#f39c12" }]}>
            {stat.est1RM != null ? `${stat.est1RM}kg` : "—"}
          </Text>
        </View>
      </View>

      {/* Minimal bar chart with Views */}
      <View style={{ marginTop: 12 }}>
        <Text style={s.muted}>Training volume across recent sessions</Text>
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
          {stat.volumes.length === 0 ? (
            <Text style={[s.muted, { padding: 8 }]}>No data yet</Text>
          ) : (
            stat.volumes.map((v, _i, arr) => {
              const max = Math.max(...arr.map((a) => a.volume));
              const h = max > 0 ? Math.round((v.volume / max) * 140) : 0;
              return (
                <View key={v.date} style={{ alignItems: "center" }}>
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
