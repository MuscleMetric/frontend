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

import { supabase } from "../../../../lib/supabase";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type { GoalMetric, GoalRow, Plan } from "../hooks/usePlanGoals";

type ViewMode = "twoWeeks" | "overall";

type Props = {
  plan: Plan;
  goal: GoalRow;
  viewMode: ViewMode;
  userId?: string | null;
  colors?: any;
  onPointPress?: (info: {
    date: Date;
    goalValue: number;
    actualValue?: number | null;
    index: number;
    workoutTitle: string | null;
    kind: "goal" | "actual";
  }) => void;
};

type PlanWorkout = {
  id: string;
  title: string | null;
  workout_id: string | null;
};

type ExerciseWorkout = {
  workout_id: string;
  title: string | null;
};

type ActualMetricPoint = {
  x: Date;
  metrics: Partial<Record<GoalMetric, number>>;
  workoutTitle: string | null;
};

type GraphPoint = {
  x: Date;
  y: number;
  label: string;
  workoutTitle: string | null;
};

const METRIC_LABEL: Record<GoalMetric, string> = {
  weight: "Weight",
  reps: "Reps",
  distance: "Distance",
  time: "Time",
};

const METRIC_UNIT: Record<GoalMetric, string> = {
  weight: "kg",
  reps: "reps",
  distance: "km",
  time: "sec",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weeksBetweenInclusive(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
  const ms = Math.max(0, e.getTime() - s.getTime());
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
}

function buildEvenDates(startIso: string, endIso: string, points: number) {
  const s = new Date(startIso);
  const e = new Date(endIso);

  if (isNaN(s.getTime()) || isNaN(e.getTime()) || points <= 1) {
    return [s, e];
  }

  return Array.from({ length: points }, (_, i) => {
    const t = i / Math.max(1, points - 1);
    return new Date(s.getTime() + t * (e.getTime() - s.getTime()));
  });
}

function metricStartKey(metric: GoalMetric) {
  switch (metric) {
    case "weight":
      return "start_weight";
    case "reps":
      return "start_reps";
    case "distance":
      return "start_distance";
    case "time":
      return "start_time_seconds";
  }
}

function metricTargetKey(metric: GoalMetric) {
  switch (metric) {
    case "weight":
      return "target_weight";
    case "reps":
      return "target_reps";
    case "distance":
      return "target_distance";
    case "time":
      return "target_time_seconds";
  }
}

function positive(n: number | null | undefined) {
  return n != null && Number.isFinite(n) && n > 0;
}

function goalValue(goal: GoalRow, side: "start" | "target", metric: GoalMetric) {
  const key = side === "start" ? metricStartKey(metric) : metricTargetKey(metric);
  const value = goal[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMetric(metric: GoalMetric, value: number) {
  if (metric === "weight") return roundToNearest(value, 2.5).toString();
  if (metric === "distance") return Number(value.toFixed(2)).toString();
  return Math.round(value).toString();
}

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}

function expectedMetricValue(
  goal: GoalRow,
  metric: GoalMetric,
  progress: number,
) {
  const start = goalValue(goal, "start", metric);
  const target = goalValue(goal, "target", metric);

  if (!positive(start) || !positive(target)) return null;

  return start! + (target! - start!) * progress;
}

function progressForMetric(goal: GoalRow, metric: GoalMetric, actual: number) {
  const start = goalValue(goal, "start", metric);
  const target = goalValue(goal, "target", metric);

  if (!positive(start) || !positive(target) || !positive(actual)) return null;
  if (start === target) return 100;

  if (metric === "time" && target! < start!) {
    return ((start! - actual) / (start! - target!)) * 100;
  }

  return ((actual - start!) / (target! - start!)) * 100;
}

function expectedLabel(goal: GoalRow, progress: number) {
  return goal.metrics
    .map((metric) => {
      const value = expectedMetricValue(goal, metric, progress);

      if (!positive(value)) {
        return `${METRIC_LABEL[metric]} —`;
      }

      return `${formatMetric(metric, value!)}${METRIC_UNIT[metric]}`;
    })
    .join(" • ");
}

function actualLabel(goal: GoalRow, metrics: Partial<Record<GoalMetric, number>>) {
  return goal.metrics
    .map((metric) => {
      const value = metrics[metric];

      if (!positive(value)) {
        return `${METRIC_LABEL[metric]} —`;
      }

      return `${formatMetric(metric, value!)}${METRIC_UNIT[metric]}`;
    })
    .join(" • ");
}

function actualProgressScore(
  goal: GoalRow,
  metrics: Partial<Record<GoalMetric, number>>,
) {
  const scores = goal.metrics
    .map((metric) => {
      const value = metrics[metric];
      if (!positive(value)) return null;
      return progressForMetric(goal, metric, value!);
    })
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (!scores.length) return null;

  const avg = scores.reduce((sum, n) => sum + n, 0) / scores.length;
  return Math.max(0, Math.min(120, avg));
}

function getBestMetricValuesFromSets(
  sets: any[],
  goal: GoalRow,
): Partial<Record<GoalMetric, number>> {
  const out: Partial<Record<GoalMetric, number>> = {};

  if (goal.metrics.includes("weight")) {
    const vals = sets.map((s) => Number(s.weight ?? 0)).filter((n) => n > 0);
    if (vals.length) out.weight = Math.max(...vals);
  }

  if (goal.metrics.includes("reps")) {
    const vals = sets.map((s) => Number(s.reps ?? 0)).filter((n) => n > 0);
    if (vals.length) out.reps = Math.max(...vals);
  }

  if (goal.metrics.includes("distance")) {
    const total = sets.reduce(
      (sum, s) => sum + Number(s.distance ?? 0),
      0,
    );
    if (total > 0) out.distance = total;
  }

  if (goal.metrics.includes("time")) {
    const total = sets.reduce(
      (sum, s) => sum + Number(s.time_seconds ?? 0),
      0,
    );
    if (total > 0) out.time = total;
  }

  return out;
}

export default function PlanGoalsGraph({
  plan,
  goal,
  viewMode,
  userId,
  onPointPress,
  colors: colorsProp,
}: Props) {
  const theme = useAppTheme();
  const colors = colorsProp ?? theme.colors;

  const [loading, setLoading] = useState(true);
  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkout[]>([]);
  const [exerciseWorkouts, setExerciseWorkouts] = useState<ExerciseWorkout[]>([]);
  const [actualRaw, setActualRaw] = useState<ActualMetricPoint[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadPlanWorkouts() {
      if (!plan?.id) return;

      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("plan_workouts")
          .select("id, title, workout_id")
          .eq("plan_id", plan.id)
          .eq("is_archived", false)
          .order("order_index", { ascending: true });

        if (error) throw error;
        if (alive) setPlanWorkouts((data ?? []) as PlanWorkout[]);
      } catch (e) {
        console.warn("planWorkouts load error:", e);
        if (alive) setPlanWorkouts([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadPlanWorkouts();

    return () => {
      alive = false;
    };
  }, [plan?.id]);

  useEffect(() => {
    let alive = true;

    async function filterGoalWorkouts() {
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
          (data ?? []).map((row: any) => row.workout_id as string),
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
    }

    filterGoalWorkouts();

    return () => {
      alive = false;
    };
  }, [plan?.id, goal?.exercises?.id, planWorkouts]);

  useEffect(() => {
    let alive = true;

    async function loadActuals() {
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
          `,
          )
          .eq("user_id", userId)
          .in("workout_id", workoutIds)
          .gte("completed_at", plan.start_date)
          .lte("completed_at", plan.end_date)
          .order("completed_at", { ascending: true });

        if (error) throw error;

        const exId = goal.exercises.id;
        const pts: ActualMetricPoint[] = [];

        (data ?? []).forEach((row: any) => {
          const histories = row.workout_exercise_history ?? [];
          const matching = histories.filter((h: any) => h.exercise_id === exId);

          if (!matching.length) return;

          const sets = matching.flatMap(
            (h: any) => h.workout_set_history ?? [],
          );

          if (!sets.length) return;

          const workout = planWorkouts.find(
            (pw) => pw.workout_id === row.workout_id,
          );

          pts.push({
            x: new Date(row.completed_at),
            metrics: getBestMetricValuesFromSets(sets, goal),
            workoutTitle: workout?.title ?? null,
          });
        });

        if (alive) setActualRaw(pts);
      } catch (e) {
        console.warn("actual goal line load error:", e);
        if (alive) setActualRaw([]);
      }
    }

    loadActuals();

    return () => {
      alive = false;
    };
  }, [
    userId,
    plan?.id,
    plan?.start_date,
    plan?.end_date,
    goal?.id,
    goal?.exercises?.id,
    goal?.metrics,
    planWorkouts,
    exerciseWorkouts,
  ]);

  const graph = useMemo(() => {
    if (!plan?.start_date || !plan?.end_date || exerciseWorkouts.length === 0) {
      return null;
    }

    if (!goal.metrics.length) return null;

    const startDate = new Date(plan.start_date);
    const endDate = new Date(plan.end_date);
    const totalMs = endDate.getTime() - startDate.getTime();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || totalMs <= 0) {
      return null;
    }

    const idealYAt = (d: Date) => {
      const t = Math.min(
        1,
        Math.max(0, (d.getTime() - startDate.getTime()) / totalMs),
      );

      return Math.round(t * 100);
    };

    const idealLabelAt = (d: Date) => {
      const t = Math.min(
        1,
        Math.max(0, (d.getTime() - startDate.getTime()) / totalMs),
      );

      return expectedLabel(goal, t);
    };

    const weeks = weeksBetweenInclusive(plan.start_date, plan.end_date);
    const sessions = Math.max(1, weeks * Math.max(1, exerciseWorkouts.length));
    const dates = buildEvenDates(plan.start_date, plan.end_date, sessions);

    const allIdeal: GraphPoint[] = dates.map((d, i) => {
      const w = exerciseWorkouts[i % exerciseWorkouts.length];

      return {
        x: d,
        y: idealYAt(d),
        label: idealLabelAt(d),
        workoutTitle: w?.title ?? `Workout ${i + 1}`,
      };
    });

    const allActual: GraphPoint[] = actualRaw
      .map((p) => {
        const score = actualProgressScore(goal, p.metrics);
        if (score == null) return null;

        return {
          x: p.x,
          y: Math.round(score),
          label: actualLabel(goal, p.metrics),
          workoutTitle: p.workoutTitle,
        };
      })
      .filter((p): p is GraphPoint => !!p);

    const now = new Date();
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(now.getTime() - TWO_WEEKS_MS);
    const windowEnd = new Date(now.getTime() + TWO_WEEKS_MS);

    let idealPoints = allIdeal;
    let actualPoints = allActual;

    if (viewMode === "twoWeeks") {
      const filteredIdeal = allIdeal.filter(
        (p) => p.x >= windowStart && p.x <= windowEnd,
      );
      idealPoints = filteredIdeal.length ? filteredIdeal : allIdeal;

      actualPoints = allActual.filter(
        (p) => p.x >= windowStart && p.x <= windowEnd,
      );
    }

    const xAll = idealPoints.concat(actualPoints).map((p) => +p.x);
    const yAll = idealPoints.concat(actualPoints).map((p) => p.y);

    const xMinData = xAll.length ? Math.min(...xAll) : startDate.getTime();
    const xMaxData = xAll.length ? Math.max(...xAll) : endDate.getTime();

    const xMin =
      viewMode === "twoWeeks"
        ? Math.min(windowStart.getTime(), xMinData)
        : xMinData;
    const xMax =
      viewMode === "twoWeeks"
        ? Math.max(windowEnd.getTime(), xMaxData)
        : xMaxData;

    const yMin = Math.min(0, ...(yAll.length ? yAll : [0]));
    const yMax = Math.max(100, ...(yAll.length ? yAll : [100]));

    const yPad = Math.max(5, (yMax - yMin) * 0.1);

    return {
      idealPoints,
      actualPoints,
      xDomain: [xMin, xMax] as [number, number],
      yDomain: [Math.max(0, yMin - yPad), Math.min(125, yMax + yPad)] as [
        number,
        number,
      ],
      xTicks: [xMin, (xMin + xMax) / 2, xMax],
      idealYAt,
      idealLabelAt,
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
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!graph) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={{ color: colors.subtle }}>
          No goal data to draw yet.
        </Text>
      </View>
    );
  }

  const { width } = Dimensions.get("window");
  const chartWidth = width - 75;

  const { idealPoints, actualPoints, xDomain, yDomain, xTicks, idealYAt } =
    graph;

  const goalColor = colors.primary ?? "#38bdf8";
  const actualColor = colors.text;
  const axis = colors.subtle;

  const goalLineData = idealPoints.map((p) => ({ x: +p.x, y: p.y }));
  const actualLineData = actualPoints.map((p) => ({ x: +p.x, y: p.y }));

  const findClosestActual = (d: Date): GraphPoint | null => {
    if (!actualPoints.length) return null;

    let best: GraphPoint | null = null;
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
    <View style={{ height: 340, padding: 1, overflow: "hidden" }}>
      <View style={{ paddingHorizontal: 6, paddingTop: 4 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 13,
            fontFamily: theme.typography?.fontFamily?.bold,
          }}
        >
          Progress vs expected path
        </Text>
        <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }}>
          0% = start • 100% = target reached
        </Text>
      </View>

      <VictoryChart
        theme={VictoryTheme.material}
        padding={{ top: 14, left: 36, right: 28, bottom: 25 }}
        domainPadding={{ y: 2 }}
        domain={{ x: xDomain as any, y: yDomain as any }}
        width={chartWidth}
        height={275}
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
          tickFormat={(t) => `${Math.round(Number(t))}%`}
          style={{
            axis: { stroke: axis },
            tickLabels: { fill: axis, fontSize: 11 },
            grid: { stroke: colors.border },
          }}
          axisLabelComponent={<VictoryLabel dy={-28} />}
        />

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

        {actualLineData.length > 0 ? (
          <VictoryLine
            data={actualLineData}
            style={{
              data: {
                stroke: actualColor,
                strokeWidth: 2.5,
              },
            }}
          />
        ) : null}

        {viewMode === "twoWeeks" ? (
          <VictoryScatter
            data={idealPoints.map((p, i) => ({
              x: +p.x,
              y: p.y,
              i,
            }))}
            size={5}
            style={{ data: { fill: goalColor } }}
            events={[
              {
                target: "data",
                eventHandlers: {
                  onPressIn: (_, props) => {
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
        ) : null}

        {viewMode === "twoWeeks" && actualPoints.length > 0 ? (
          <VictoryScatter
            data={actualPoints.map((p, i) => ({
              x: +p.x,
              y: p.y,
              i,
            }))}
            size={5}
            style={{ data: { fill: actualColor } }}
            events={[
              {
                target: "data",
                eventHandlers: {
                  onPressIn: (_, props) => {
                    const idx = props.datum.i as number;
                    const p = actualPoints[idx];

                    onPointPress?.({
                      date: p.x,
                      goalValue: idealYAt(p.x),
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
        ) : null}
      </VictoryChart>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          marginTop: -2,
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
          <Text style={{ fontSize: 11, color: colors.subtle }}>Expected</Text>
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