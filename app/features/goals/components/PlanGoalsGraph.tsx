// app/(features)/goals/components/PlanGoalsGraph.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Dimensions } from "react-native";
import {
  VictoryChart,
  VictoryAxis,
  VictoryLine,
  VictoryScatter,
  VictoryTheme,
  VictoryLabel,
} from "victory-native";
import { supabase } from "../../../../../lib/supabase";

export type Plan = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

export type GoalRow = {
  id: string;
  type: "exercise_weight" | "exercise_reps" | "distance" | "time";
  target_number: number;
  unit: string | null;
  deadline: string | null;
  is_active: boolean | null;
  notes: string | null; // { start?: number }
  exercises: { id: string | null; name: string | null } | null;
  created_at?: string | null;
};

type ViewMode = "twoWeeks" | "overall";

type Props = {
  plan: Plan;
  goal: GoalRow;
  colors: any;
  viewMode: ViewMode;
  userId?: string | null;
  onPointPress?: (info: {
    date: Date;
    goalValue: number;
    actualValue?: number | null;
    index: number;
    workoutTitle: string | null;
    kind: "goal" | "actual";
  }) => void;
};

/* ---------- helpers ---------- */

function parseStart(notes?: string | null): number | null {
  if (!notes) return null;
  try {
    const obj = JSON.parse(notes);
    if (typeof obj?.start === "number") return obj.start;
  } catch {}
  return null;
}

function weeksBetweenInclusive(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
  const ms = Math.max(0, e.getTime() - s.getTime());
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
}

function buildEvenDates(
  startIso: string,
  endIso: string,
  points: number
): Date[] {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || points <= 1) return [s, e];
  const out: Date[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    out.push(new Date(s.getTime() + t * (e.getTime() - s.getTime())));
  }
  return out;
}

const roundQuarter = (n: number) => Math.round(n * 4) / 4;
const roundTime = (s: number) => Math.round(s / 5) * 5;
const roundDistance = (d: number) => Math.round(d * 10) / 10;

function coerceUnitRound(value: number, type: GoalRow["type"]): number {
  switch (type) {
    case "exercise_weight":
    case "exercise_reps":
      return roundQuarter(value);
    case "distance":
      return roundDistance(value);
    case "time":
      return roundTime(value);
    default:
      return value;
  }
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

type SessionPoint = {
  x: Date;
  y: number;
  workoutTitle: string | null;
};

/* ---------- component ---------- */

export default function PlanGoalsGraph({
  plan,
  goal,
  colors,
  viewMode,
  userId,
  onPointPress,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [planWorkouts, setPlanWorkouts] = useState<
    { id: string; title: string | null; workout_id: string | null }[]
  >([]);
  const [actualRaw, setActualRaw] = useState<SessionPoint[]>([]);

  // only workouts in this plan that actually contain the goal exercise
  const [exerciseWorkouts, setExerciseWorkouts] = useState<
    { workout_id: string; title: string | null }[]
  >([]);

  // load workouts for this plan so we know names + workout_id
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!plan?.id) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("plan_workouts")
          .select("id, title, workout_id")
          .eq("plan_id", plan.id)
          .order("order_index", { ascending: true });

        if (error) throw error;
        if (alive) setPlanWorkouts(data ?? []);
      } catch (e) {
        console.warn("planWorkouts load error:", e);
        if (alive) setPlanWorkouts([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [plan?.id]);

  // filter to plan workouts that actually contain this exercise
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!plan?.id || !goal?.exercises?.id || !planWorkouts.length) {
        if (alive) setExerciseWorkouts([]);
        return;
      }

      const workoutIds = planWorkouts
        .map((pw) => pw.workout_id)
        .filter((id): id is string => !!id);

      if (!workoutIds.length) {
        if (alive) setExerciseWorkouts([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("workout_exercises")
          .select("workout_id")
          .in("workout_id", workoutIds)
          .eq("exercise_id", goal.exercises.id)
          .eq("is_archived", false);

        if (error) throw error;

        const allowedIds = new Set(
          (data ?? []).map((row: any) => row.workout_id as string)
        );

        const filtered = planWorkouts
          .filter((pw) => pw.workout_id && allowedIds.has(pw.workout_id))
          .map((pw) => ({
            workout_id: pw.workout_id as string,
            title: pw.title,
          }));

        if (alive) setExerciseWorkouts(filtered);
      } catch (e) {
        console.warn("exerciseWorkouts filter error:", e);
        if (alive) setExerciseWorkouts([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [plan?.id, goal?.exercises?.id, planWorkouts]);

  // load actual history-based progression for this exercise
  useEffect(() => {
    let alive = true;
    (async () => {
      if (
        !userId ||
        !plan?.id ||
        !plan.start_date ||
        !plan.end_date ||
        !goal?.exercises?.id ||
        exerciseWorkouts.length === 0
      ) {
        if (alive) setActualRaw([]);
        return;
      }

      const workoutIds = exerciseWorkouts.map((w) => w.workout_id);

      if (!workoutIds.length) {
        if (alive) setActualRaw([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("workout_history")
          .select(
            `
            id,
            workout_id,
            completed_at,
            workout_exercise_history!inner(
              id,
              exercise_id,
              workout_set_history (
                reps,
                weight,
                time_seconds,
                distance
              )
            )
          `
          )
          .eq("user_id", userId)
          .in("workout_id", workoutIds)
          .gte("completed_at", plan.start_date)
          .lte("completed_at", plan.end_date)
          .order("completed_at", { ascending: true });

        if (error) throw error;

        const exId = goal.exercises?.id;
        const pts: SessionPoint[] = [];

        (data ?? []).forEach((row: any) => {
          const eh = (row.workout_exercise_history ?? []).find(
            (h: any) => h.exercise_id === exId
          );
          if (!eh) return;
          const sets = eh.workout_set_history ?? [];
          if (!sets.length) return;

          let rawVal = 0;

          switch (goal.type) {
            case "exercise_weight": {
              // Use best weight in this session (what the user actually sees).
              rawVal = Math.max(...sets.map((s: any) => Number(s.weight ?? 0)));
              break;
            }

            case "exercise_reps": {
              rawVal = Math.max(...sets.map((s: any) => Number(s.reps ?? 0)));
              break;
            }

            case "distance": {
              rawVal = sets.reduce(
                (sum: number, s: any) => sum + Number(s.distance ?? 0),
                0
              );
              break;
            }

            case "time": {
              rawVal = sets.reduce(
                (sum: number, s: any) => sum + Number(s.time_seconds ?? 0),
                0
              );
              break;
            }

            default: {
              rawVal = 0;
            }
          }

          const workout = planWorkouts.find(
            (pw) => pw.workout_id === row.workout_id
          );
          const workoutTitle = workout?.title ?? null;

          pts.push({
            x: new Date(row.completed_at),
            y: coerceUnitRound(rawVal, goal.type),
            workoutTitle,
          });
        });

        if (alive) setActualRaw(pts);
      } catch (e) {
        console.warn("actual goal line load error:", e);
        if (alive) setActualRaw([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    userId,
    plan?.id,
    plan?.start_date,
    plan?.end_date,
    goal?.id,
    goal?.type,
    goal?.notes,
    goal?.exercises?.id,
    planWorkouts,
    exerciseWorkouts,
  ]);

  const graph = useMemo(() => {
    if (!plan?.start_date || !plan?.end_date || exerciseWorkouts.length === 0) {
      return null;
    }

    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);
    const totalMs = endDate.getTime() - startDate.getTime();

    // helper: ideal Y at any date (continuous)
    const startVal = (() => {
      const s = parseStart(goal.notes);
      return typeof s === "number" ? s : 0;
    })();
    const targetVal = goal.target_number;
    const idealYAt = (d: Date) => {
      if (
        isNaN(startDate.getTime()) ||
        isNaN(endDate.getTime()) ||
        totalMs <= 0
      )
        return targetVal;
      const t = Math.min(
        1,
        Math.max(0, (d.getTime() - startDate.getTime()) / totalMs)
      );
      return coerceUnitRound(startVal + t * (targetVal - startVal), goal.type);
    };

    const weeks = weeksBetweenInclusive(plan.start_date, plan.end_date);
    const perWeek = exerciseWorkouts.length;
    const sessions = Math.max(1, weeks * perWeek);

    const dates = buildEvenDates(plan.start_date, plan.end_date, sessions);

    // ideal points along goal curve (evenly spaced by session)
    const allIdeal: SessionPoint[] = dates.map((d, i) => {
      const y = idealYAt(d);
      const w = exerciseWorkouts[i % exerciseWorkouts.length];
      const workoutTitle = w?.title ?? `Workout ${i + 1}`;
      return { x: d, y, workoutTitle };
    });

    // actual points (from history) as-is
    const allActual: SessionPoint[] = actualRaw.slice();

    const now = new Date();

    // "month" view = 2 weeks before and 2 weeks into the future
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(now.getTime() - TWO_WEEKS_MS);
    const windowEnd = new Date(now.getTime() + TWO_WEEKS_MS);

    let idealPoints = allIdeal;
    if (viewMode === "twoWeeks") {
      const filtered = allIdeal.filter(
        (p) => p.x >= windowStart && p.x <= windowEnd
      );
      idealPoints = filtered.length ? filtered : allIdeal;
    }

    let actualPoints = allActual;
    if (viewMode === "twoWeeks") {
      actualPoints = allActual.filter(
        (p) => p.x >= windowStart && p.x <= windowEnd
      );
    }

    const xIdeal = idealPoints.map((p) => +p.x);
    const yIdeal = idealPoints.map((p) => p.y);
    const xActual = actualPoints.map((p) => +p.x);
    const yActual = actualPoints.map((p) => p.y);

    const xAll = xIdeal.concat(xActual);
    let yAll = yIdeal.concat(yActual);

    const fallbackXDomain: [number, number] = [
      startDate.getTime(),
      endDate.getTime(),
    ];
    const fallbackYDomain: [number, number] = [startVal, targetVal];

    if (!xAll.length || !yAll.length) {
      return {
        idealPoints,
        actualPoints,
        xDomain: fallbackXDomain,
        yDomain: fallbackYDomain,
        xTicks: [fallbackXDomain[0], fallbackXDomain[1]],
        idealYAt,
      };
    }

    const xMinData = Math.min(...xAll);
    const xMaxData = Math.max(...xAll);

    const xMin =
      viewMode === "twoWeeks"
        ? Math.min(windowStart.getTime(), xMinData)
        : xMinData;
    const xMax =
      viewMode === "twoWeeks"
        ? Math.max(windowEnd.getTime(), xMaxData)
        : xMaxData;

    const yMin = Math.min(...yAll);
    const yMax = Math.max(...yAll);
    const yPad = Math.max(1, (yMax - yMin) * 0.1);

    const xTicks = [xMin, (xMin + xMax) / 2, xMax];

    return {
      idealPoints,
      actualPoints,
      xDomain: [xMin, xMax] as [number, number],
      yDomain: [yMin - yPad, yMax + yPad] as [number, number],
      xTicks,
      idealYAt,
    };
  }, [
    plan?.start_date,
    plan?.end_date,
    exerciseWorkouts,
    goal,
    viewMode,
    actualRaw,
  ]);

  if (loading) {
    return (
      <View style={{ padding: 8 }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!graph) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={{ color: colors.subtle }}>No data to draw.</Text>
      </View>
    );
  }

  const { width } = Dimensions.get("window");
  const chartWidth = width - 75;

  const { idealPoints, actualPoints, xDomain, yDomain, xTicks, idealYAt } =
    graph;

  // COLORS
  const goalColor = "#38bdf8"; // light blue
  const actualColor = colors.text; // black/white
  const axis = colors.subtle;

  const goalLineData = idealPoints.map((p) => ({ x: +p.x, y: p.y }));
  const actualLineData = actualPoints.map((p) => ({ x: +p.x, y: p.y }));

  // helper to find the closest actual point to a given date (for goal dots)
  const findClosestActual = (d: Date): SessionPoint | null => {
    if (!actualPoints.length) return null;
    let best: SessionPoint | null = null;
    let bestDiff = Infinity;
    const t = d.getTime();
    for (const p of actualPoints) {
      const diff = Math.abs(p.x.getTime() - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    }
    return best;
  };

  return (
    <View
      style={{
        height: 340,
        padding: 1,
        overflow: "hidden",
      }}
    >
      <VictoryChart
        theme={VictoryTheme.material}
        padding={{ top: 14, left: 30, right: 28, bottom: 25 }}
        domainPadding={{ y: 2 }}
        domain={{ x: xDomain as any, y: yDomain as any }}
        width={chartWidth}
        height={300}
      >
        <VictoryAxis
          tickValues={xTicks}
          tickFormat={(t) => fmtDate(new Date(t as number))}
          style={{
            axis: { stroke: axis },
            tickLabels: { fill: axis, fontSize: 11 },
            grid: { stroke: colors.border },
          }}
        />
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: axis },
            tickLabels: { fill: axis, fontSize: 11 },
            grid: { stroke: colors.border },
          }}
          axisLabelComponent={<VictoryLabel dy={-28} />}
        />

        {/* dotted ideal goal trajectory (light blue) */}
        <VictoryLine
          data={goalLineData}
          style={{
            data: {
              stroke: goalColor,
              strokeDasharray: "3,5",
              strokeWidth: 2,
            },
          }}
        />

        {/* solid actual trajectory (black) */}
        {actualLineData.length > 0 && (
          <VictoryLine
            data={actualLineData}
            style={{
              data: {
                stroke: actualColor,
                strokeWidth: 2.5,
              },
            }}
          />
        )}

        {/* dots on ideal (projected) line */}
        {viewMode === "twoWeeks" && (
          <VictoryScatter
            data={idealPoints.map((p, i) => ({
              x: +p.x,
              y: p.y,
              i,
            }))}
            size={5}
            style={{
              data: { fill: goalColor },
            }}
            events={[
              {
                target: "data",
                eventHandlers: {
                  onPressIn: (_, props) => {
                    if (viewMode !== "twoWeeks") return [];
                    const idx = props.datum.i as number;
                    const p = idealPoints[idx];

                    const closestActual = findClosestActual(p.x);

                    onPointPress?.({
                      date: p.x,
                      goalValue: p.y,
                      actualValue: closestActual?.y ?? null,
                      index: idx,
                      workoutTitle: p.workoutTitle,
                      kind: "goal",
                    });
                    return [];
                  },
                },
              },
            ]}
          />
        )}

        {/* dots on actual (history) line */}
        {viewMode === "twoWeeks" && actualPoints.length > 0 && (
          <VictoryScatter
            data={actualPoints.map((p, i) => ({
              x: +p.x,
              y: p.y,
              i,
            }))}
            size={5}
            style={{
              data: { fill: actualColor },
            }}
            events={[
              {
                target: "data",
                eventHandlers: {
                  onPressIn: (_, props) => {
                    if (viewMode !== "twoWeeks") return [];
                    const idx = props.datum.i as number;
                    const p = actualPoints[idx];
                    const goalAtDate = idealYAt(p.x);

                    onPointPress?.({
                      date: p.x,
                      goalValue: goalAtDate,
                      actualValue: p.y,
                      index: idx,
                      workoutTitle: p.workoutTitle,
                      kind: "actual",
                    });
                    return [];
                  },
                },
              },
            ]}
          />
        )}
      </VictoryChart>

      {/* Tiny legend under the chart */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          marginTop: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: goalColor,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.subtle }}>Goal</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: actualColor,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.subtle }}>Actual</Text>
        </View>
      </View>
    </View>
  );
}
