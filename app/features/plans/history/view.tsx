// app/features/plans/history/view.tsx  (or wherever this screen lives)
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Animated,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import Svg, { Rect } from "react-native-svg";

import { Screen, ScreenHeader, Card, Button, Pill, MiniRing } from "@/ui";

type PlanRow = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  is_completed?: boolean | null;
  weekly_target_sessions?: number | null;
};

type PlanWorkoutRow = {
  workout_id: string;
  title: string | null;
  is_archived?: boolean | null;
};

type GoalRow = {
  id: string;
  type: "exercise_weight" | "exercise_reps" | "distance" | "time" | string;
  target_number: number | string;
  notes: string | null;
  exercises?: { id: string; name: string | null } | null;
};

type SessionRow = {
  id: string;
  workout_id: string | null;
  completed_at: string;
  duration_seconds: number | null;
  workout_exercise_history: Array<{
    exercise_id: string;
    workout_set_history: Array<{
      reps: number | null;
      weight: number | null;
      time_seconds: number | null;
      distance: number | null;
    }>;
  }>;
};

type BestSet = {
  exerciseId: string;
  weight: number;
  reps: number;
  time_seconds: number;
  distance: number;
  completed_at: string;
};

type Stats = {
  plannedWorkouts: number;

  sessionsPlanned: number;
  sessionsCompleted: number;
  sessionsMissed: number;

  uniqueWorkoutsHit: number;
  missedWorkouts: number;

  totalSets: number;
  totalReps: number;
  totalVolume: number;
  totalTimeSeconds: number;

  weeklySessions: { week: string; count: number }[];

  bestSet: BestSet | null;
  topExerciseBySets: { exerciseId: string; name: string; sets: number } | null;

  mostImproved: {
    exerciseId: string;
    name: string;
    from: { weight: number; reps: number; completed_at: string } | null;
    to: { weight: number; reps: number; completed_at: string } | null;
    pct: number;
  } | null;

  workoutCounts: {
    most: { workoutId: string; title: string; count: number } | null;
    least: { workoutId: string; title: string; count: number } | null;
  };

  biggestSession: { workoutId: string; title: string; volume: number } | null;

  goalSummaries: Array<{
    id: string;
    name: string;
    type: string;
    progress: number;
    label: string;
  }>;

  consistencyPct: number;
  avgVolumePerSession: number;
};

type WorkoutWithExercises = {
  id: string;
  title: string;
  exercises: Array<{ id: string; name: string }>;
};

function parseStart(notes?: string | null): number | null {
  if (!notes) return null;
  try {
    const obj = JSON.parse(notes);
    if (typeof obj?.start === "number") return obj.start;
  } catch {}
  return null;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function formatLongDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function secondsToHhMm(total?: number | null) {
  const s = Math.max(0, Number(total ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function weekStartKeySunday(iso: string) {
  const d = new Date(iso);
  const copy = new Date(d);
  const dow = copy.getDay(); // 0 = Sun
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - dow);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetweenInclusive(aIso: string, bIso: string) {
  const a = new Date(aIso);
  const b = new Date(bIso);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const ms = b.getTime() - a.getTime();
  const days = Math.floor(ms / 86400000) + 1;
  return Math.max(1, days);
}

function weeksCeilInclusive(aIso: string, bIso: string) {
  const days = daysBetweenInclusive(aIso, bIso);
  return Math.max(1, Math.ceil(days / 7));
}

function MiniBarChart({
  width,
  values,
  height = 44,
  fill,
}: {
  width: number;
  values: number[];
  height?: number;
  fill: string;
}) {
  const w = width;
  const gap = 4;
  const n = Math.max(values.length, 1);
  const barW = Math.max(6, Math.floor((w - gap * (n - 1)) / n));
  const max = Math.max(...values, 1);

  return (
    <Svg width={w} height={height}>
      {values.map((v, i) => {
        const h = (v / max) * (height - 6);
        return (
          <Rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={4}
            fill={fill}
            opacity={0.9}
          />
        );
      })}
    </Svg>
  );
}

function formatLastSet(
  set:
    | {
        reps: number | null;
        weight: number | null;
        time_seconds: number | null;
        distance: number | null;
      }
    | null
    | undefined
) {
  if (!set) return "—";

  const reps = set.reps ?? null;
  const weight = set.weight ?? null;
  const time = set.time_seconds ?? null;
  const dist = set.distance ?? null;

  if ((reps != null && reps > 0) || (weight != null && weight > 0)) {
    const w = weight != null ? Math.round(weight) : 0;
    const r = reps != null ? Math.round(reps) : 0;
    if (w > 0 && r > 0) return `${w} × ${r}`;
    if (w > 0) return `${w} kg`;
    if (r > 0) return `${r} reps`;
  }

  if (dist != null && dist > 0) return `${dist.toFixed(1)} km`;
  if (time != null && time > 0) return secondsToHhMm(time);

  return "—";
}

export default function PlanHistoryViewScreen() {
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanRow | null>(null);

  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkoutRow[]>([]);
  const [planSessions, setPlanSessions] = useState<SessionRow[]>([]);
  const [timeSessions, setTimeSessions] = useState<SessionRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [chartWidth, setChartWidth] = useState(0);
  const [workoutsWithExercises, setWorkoutsWithExercises] = useState<
    WorkoutWithExercises[]
  >([]);
  const [hasActivePlanNow, setHasActivePlanNow] = useState<boolean>(false);

  const ctaScale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(ctaScale, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true }).start();

  const isActivePlan = useMemo(() => {
    if (!plan) return false;
    if (plan.is_completed === false) return true;
    return !plan.completed_at;
  }, [plan]);

  const showStartNewPlanCta = useMemo(() => {
    return !!plan && !isActivePlan && !hasActivePlanNow;
  }, [plan, isActivePlan, hasActivePlanNow]);

  // last set per exercise (for active view)
  const lastSetByExercise = useMemo(() => {
    const out: Record<
      string,
      {
        completed_at: string;
        set: {
          reps: number | null;
          weight: number | null;
          time_seconds: number | null;
          distance: number | null;
        } | null;
      }
    > = {};

    for (let i = timeSessions.length - 1; i >= 0; i--) {
      const sess = timeSessions[i];
      for (const eh of sess.workout_exercise_history ?? []) {
        const exId = eh.exercise_id;
        if (out[exId]) continue;
        const sets = eh.workout_set_history ?? [];
        const lastSet = sets.length ? sets[sets.length - 1] : null;
        out[exId] = { completed_at: sess.completed_at, set: lastSet };
      }
    }
    return out;
  }, [timeSessions]);

  // ACTIVE “quick goals” summaries
  const activeGoalSummaries = useMemo(() => {
    const exerciseGoals = goals.filter((g) => g?.exercises?.id).slice(0, 6);
    if (!exerciseGoals.length) return [];

    const byExercise: Record<string, number> = {};

    for (let i = timeSessions.length - 1; i >= 0; i--) {
      const sess = timeSessions[i];
      for (const eh of sess.workout_exercise_history ?? []) {
        const exId = eh.exercise_id;
        if (byExercise[exId] != null) continue;

        const g = exerciseGoals.find((x) => String(x.exercises?.id) === exId);
        if (!g) continue;

        const sets = eh.workout_set_history ?? [];
        if (!sets.length) continue;

        let rawVal = 0;
        switch (g.type) {
          case "exercise_weight":
            rawVal = Math.max(...sets.map((s) => Number(s.weight ?? 0)));
            break;
          case "exercise_reps":
            rawVal = Math.max(...sets.map((s) => Number(s.reps ?? 0)));
            break;
          case "distance":
            rawVal = sets.reduce((sum, s) => sum + Number(s.distance ?? 0), 0);
            break;
          case "time":
            rawVal = sets.reduce(
              (sum, s) => sum + Number(s.time_seconds ?? 0),
              0
            );
            break;
          default:
            rawVal = 0;
        }

        byExercise[exId] = rawVal;
      }
    }

    return exerciseGoals.map((g) => {
      const exId = String(g.exercises!.id);
      const name = String(g.exercises!.name ?? "Goal exercise");
      const target = Number(g.target_number ?? 0);
      const startParsed = parseStart(g.notes);
      const start = typeof startParsed === "number" ? startParsed : 0;

      const actual = byExercise[exId] != null ? byExercise[exId] : start;

      const denom = target - start;
      const progress =
        denom > 0
          ? clamp01((actual - start) / denom)
          : actual >= target
          ? 1
          : 0;

      const label =
        g.type === "exercise_weight" || g.type === "exercise_reps"
          ? `${Math.round(actual)} / ${Math.round(target)}`
          : g.type === "distance"
          ? `${actual.toFixed(1)} / ${target.toFixed(1)}`
          : g.type === "time"
          ? `${Math.round(actual)}s / ${Math.round(target)}s`
          : `${actual} / ${target}`;

      return { id: g.id, name, type: g.type, progress, label };
    });
  }, [goals, timeSessions]);

  useEffect(() => {
    if (!userId || !planId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        if (!cancelled) {
          setWorkoutsWithExercises([]);
          setStats(null);
        }

        // active plan exists now?
        const { data: activeNow, error: activeErr } = await supabase
          .from("plans")
          .select("id")
          .eq("user_id", userId)
          .eq("is_completed", false)
          .limit(1)
          .maybeSingle();

        if (!cancelled) setHasActivePlanNow(!!activeNow && !activeErr);

        // plan
        const { data: planData, error: pErr } = await supabase
          .from("plans")
          .select(
            "id, title, start_date, end_date, completed_at, is_completed, weekly_target_sessions"
          )
          .eq("id", planId)
          .eq("user_id", userId)
          .maybeSingle();

        if (pErr) throw pErr;
        if (cancelled) return;

        const p = planData as any as PlanRow | null;
        setPlan(p);

        if (!p?.id) {
          if (!cancelled) {
            setPlanWorkouts([]);
            setPlanSessions([]);
            setGoals([]);
            setStats(null);
            setWorkoutsWithExercises([]);
          }
          return;
        }

        // workouts in plan
        const { data: pw, error: pwErr } = await supabase
          .from("plan_workouts")
          .select("workout_id, title, is_archived")
          .eq("plan_id", p.id)
          .order("order_index", { ascending: true });

        if (pwErr) throw pwErr;
        if (cancelled) return;

        const pwRows: PlanWorkoutRow[] = Array.isArray(pw)
          ? pw.map((r: any) => ({
              workout_id: String(r.workout_id),
              title: r.title ?? null,
              is_archived: r.is_archived ?? false,
            }))
          : [];

        const isPlanActive =
          p?.is_completed === false || (p?.completed_at == null && p != null);

        const visiblePw = isPlanActive
          ? pwRows.filter((r) => !r.is_archived)
          : pwRows;
        setPlanWorkouts(visiblePw);

        const workoutIds = visiblePw.map((r) => r.workout_id).filter(Boolean);
        const plannedWorkouts = workoutIds.length;

        // weekly goal fallback
        const { data: prof } = await supabase
          .from("profiles")
          .select("weekly_workout_goal")
          .eq("id", userId)
          .maybeSingle();

        const workoutsPerWeek =
          p.weekly_target_sessions != null
            ? Number(p.weekly_target_sessions)
            : prof?.weekly_workout_goal != null
            ? Number(prof.weekly_workout_goal)
            : 3;

        // time bounds
        const start = p.start_date ?? "1970-01-01";
        const endTs = p.completed_at
          ? p.completed_at
          : new Date().toISOString();

        // goals
        const { data: gData, error: gErr } = await supabase
          .from("goals")
          .select(
            "id, type, target_number, notes, is_active, exercises(id, name)"
          )
          .eq("user_id", userId)
          .eq("plan_id", p.id)
          .order("created_at", { ascending: true })
          .limit(24);

        if (gErr) console.warn("goals load error:", gErr);

        if (!cancelled) {
          setGoals(
            Array.isArray(gData)
              ? gData.map((g: any) => ({
                  id: String(g.id),
                  type: g.type,
                  target_number: g.target_number,
                  notes: g.notes ?? null,
                  exercises: g.exercises
                    ? {
                        id: String(g.exercises.id),
                        name: g.exercises.name ?? null,
                      }
                    : null,
                }))
              : []
          );
        }

        // sessions (plan-only)
        let planSessRows: SessionRow[] = [];
        if (workoutIds.length) {
          const { data: sData, error: sErr } = await supabase
            .from("workout_history")
            .select(
              `
              id,
              workout_id,
              completed_at,
              duration_seconds,
              workout_exercise_history(
                exercise_id,
                workout_set_history(reps, weight, time_seconds, distance)
              )
            `
            )
            .eq("user_id", userId)
            .in("workout_id", workoutIds)
            .gte("completed_at", start)
            .lte("completed_at", endTs)
            .order("completed_at", { ascending: true });

          if (sErr) throw sErr;
          planSessRows = Array.isArray(sData) ? mapSessions(sData) : [];
        }

        // sessions (timeSessions: all workouts in time range)
        let timeSessRows: SessionRow[] = [];
        {
          const { data: tData, error: tErr } = await supabase
            .from("workout_history")
            .select(
              `
              id,
              workout_id,
              completed_at,
              duration_seconds,
              workout_exercise_history(
                exercise_id,
                workout_set_history(reps, weight, time_seconds, distance)
              )
            `
            )
            .eq("user_id", userId)
            .gte("completed_at", start)
            .lte("completed_at", endTs)
            .order("completed_at", { ascending: true });

          if (tErr) throw tErr;
          timeSessRows = Array.isArray(tData) ? mapSessions(tData) : [];
        }

        function mapSessions(rows: any[]): SessionRow[] {
          return rows.map((r: any) => ({
            id: String(r.id),
            workout_id: r.workout_id != null ? String(r.workout_id) : null,
            completed_at: String(r.completed_at),
            duration_seconds:
              r.duration_seconds != null ? Number(r.duration_seconds) : null,
            workout_exercise_history: Array.isArray(r.workout_exercise_history)
              ? r.workout_exercise_history.map((eh: any) => ({
                  exercise_id: String(eh.exercise_id),
                  workout_set_history: Array.isArray(eh.workout_set_history)
                    ? eh.workout_set_history.map((s: any) => ({
                        reps: s.reps != null ? Number(s.reps) : null,
                        weight: s.weight != null ? Number(s.weight) : null,
                        time_seconds:
                          s.time_seconds != null
                            ? Number(s.time_seconds)
                            : null,
                        distance:
                          s.distance != null ? Number(s.distance) : null,
                      }))
                    : [],
                }))
              : [],
          }));
        }

        if (!cancelled) {
          setPlanSessions(planSessRows);
          setTimeSessions(timeSessRows);
        }

        // workout -> exercises (for active list)
        if (workoutIds.length) {
          const { data: wData, error: wErr } = await supabase
            .from("workouts")
            .select(
              `
              id,
              title,
              workout_exercises(
                exercise_id,
                exercises(id, name)
              )
            `
            )
            .in("id", workoutIds);

          if (wErr) {
            console.warn("workouts load error:", wErr);
          } else if (!cancelled && Array.isArray(wData)) {
            const mapped: WorkoutWithExercises[] = wData.map((w: any) => {
              const exs = Array.isArray(w.workout_exercises)
                ? w.workout_exercises
                : [];
              const exercises = exs
                .map((we: any) => {
                  const ex = we.exercises;
                  if (!ex?.id) return null;
                  return {
                    id: String(ex.id),
                    name: String(ex.name ?? "Exercise"),
                  };
                })
                .filter(Boolean) as Array<{ id: string; name: string }>;

              return {
                id: String(w.id),
                title: String(w.title ?? "Workout"),
                exercises,
              };
            });

            const orderIndex: Record<string, number> = {};
            workoutIds.forEach((id, idx) => (orderIndex[id] = idx));
            mapped.sort(
              (a, b) => (orderIndex[a.id] ?? 0) - (orderIndex[b.id] ?? 0)
            );

            setWorkoutsWithExercises(mapped);
          }
        }

        // stats (completed view)
        const sessionsCompleted = planSessRows.length;

        const startForWeeks = p.start_date ?? start;
        const endForWeeks = p.end_date ?? p.completed_at ?? null;
        const weeks =
          startForWeeks && endForWeeks
            ? weeksCeilInclusive(startForWeeks, endForWeeks)
            : 1;

        const sessionsPlanned = Math.max(
          0,
          weeks * Math.max(0, workoutsPerWeek)
        );
        const sessionsMissed = Math.max(0, sessionsPlanned - sessionsCompleted);
        const consistencyPct =
          sessionsPlanned > 0
            ? clamp01(sessionsCompleted / sessionsPlanned)
            : 0;

        let uniqueWorkoutsHit = 0;
        if (workoutIds.length) {
          const { data: uniq } = await supabase
            .from("workout_history")
            .select("workout_id")
            .eq("user_id", userId)
            .in("workout_id", workoutIds)
            .gte("completed_at", start)
            .lte("completed_at", endTs);

          if (Array.isArray(uniq)) {
            const set = new Set(uniq.map((r: any) => String(r.workout_id)));
            uniqueWorkoutsHit = set.size;
          }
        }

        const missedWorkouts = Math.max(0, plannedWorkouts - uniqueWorkoutsHit);

        let totalSets = 0;
        let totalReps = 0;
        let totalVolume = 0;
        let totalTimeSeconds = 0;

        const setsByExercise: Record<string, number> = {};
        const bestSetByExercise: Record<
          string,
          { weight: number; reps: number; completed_at: string }
        > = {};
        const firstBestSetByExercise: Record<
          string,
          { weight: number; reps: number; completed_at: string }
        > = {};

        let biggestSessionWorkoutId: string | null = null;
        let biggestSessionVolume = 0;

        planSessRows.forEach((sess) => {
          totalTimeSeconds += Number(sess.duration_seconds ?? 0);

          let sessionVolume = 0;

          (sess.workout_exercise_history ?? []).forEach((eh) => {
            const exId = eh.exercise_id;
            const sets = eh.workout_set_history ?? [];

            sets.forEach((s) => {
              totalSets += 1;
              const reps = Number(s.reps ?? 0);
              const weight = Number(s.weight ?? 0);

              totalReps += reps;

              const vol = reps * weight;
              totalVolume += vol;
              sessionVolume += vol;

              setsByExercise[exId] = (setsByExercise[exId] ?? 0) + 1;

              const existing = bestSetByExercise[exId];
              if (!existing || weight > existing.weight) {
                bestSetByExercise[exId] = {
                  weight,
                  reps,
                  completed_at: sess.completed_at,
                };
              }
            });

            if (firstBestSetByExercise[exId] == null && sets.length) {
              let bestW = 0;
              let bestR = 0;
              sets.forEach((s) => {
                const w = Number(s.weight ?? 0);
                if (w > bestW) {
                  bestW = w;
                  bestR = Number(s.reps ?? 0);
                }
              });
              firstBestSetByExercise[exId] = {
                weight: bestW,
                reps: bestR,
                completed_at: sess.completed_at,
              };
            }
          });

          if (sessionVolume > biggestSessionVolume) {
            biggestSessionVolume = sessionVolume;
            biggestSessionWorkoutId = sess.workout_id ?? null;
          }
        });

        // Best set across all exercises
        let bestSet: BestSet | null = null;
        for (const [exId, br] of Object.entries(bestSetByExercise)) {
          if (!bestSet || br.weight > bestSet.weight) {
            bestSet = {
              exerciseId: exId,
              weight: br.weight,
              reps: br.reps,
              time_seconds: 0,
              distance: 0,
              completed_at: br.completed_at,
            };
          }
        }

        // Top exercise by sets
        let topExerciseSetsId: string | null = null;
        let topSets = 0;
        Object.entries(setsByExercise).forEach(([exId, c]) => {
          if (c > topSets) {
            topSets = c;
            topExerciseSetsId = exId;
          }
        });

        // Most improved by weight %
        let bestPct = 0;
        let bestImprovedId: string | null = null;
        Object.keys(bestSetByExercise).forEach((exId) => {
          const from = firstBestSetByExercise[exId];
          const to = bestSetByExercise[exId];
          if (!from || !to) return;
          const denom = Math.max(1, from.weight);
          const pct = (to.weight - from.weight) / denom;
          if (pct > bestPct && to.weight > from.weight) {
            bestPct = pct;
            bestImprovedId = exId;
          }
        });

        // Resolve names we need
        const needIds: string[] = [];
        if (bestSet) needIds.push(bestSet.exerciseId);
        if (topExerciseSetsId) needIds.push(topExerciseSetsId);
        if (bestImprovedId) needIds.push(bestImprovedId);

        const uniqueNeedIds = Array.from(new Set(needIds));
        const nameById: Record<string, string> = {};

        if (uniqueNeedIds.length) {
          const { data: exData } = await supabase
            .from("exercises")
            .select("id, name")
            .in("id", uniqueNeedIds);

          if (Array.isArray(exData)) {
            exData.forEach((r: any) => {
              nameById[String(r.id)] = String(r.name ?? "Exercise");
            });
          }
        }

        const topExerciseBySets =
          topExerciseSetsId != null
            ? {
                exerciseId: topExerciseSetsId,
                name: nameById[topExerciseSetsId] ?? "Top exercise",
                sets: topSets,
              }
            : null;

        const mostImproved =
          bestImprovedId != null
            ? {
                exerciseId: bestImprovedId,
                name: nameById[bestImprovedId] ?? "Most improved",
                from: firstBestSetByExercise[bestImprovedId] ?? null,
                to: bestSetByExercise[bestImprovedId] ?? null,
                pct: bestPct,
              }
            : null;

        // Workout consistency most/least
        const workoutTitleById: Record<string, string> = {};
        visiblePw.forEach((w) => {
          workoutTitleById[w.workout_id] = String(w.title ?? "Workout");
        });

        const workoutCounts: Record<string, number> = {};
        planSessRows.forEach((s) => {
          const wid = s.workout_id;
          if (!wid) return;
          workoutCounts[wid] = (workoutCounts[wid] ?? 0) + 1;
        });
        workoutIds.forEach((wid) => {
          if (workoutCounts[wid] == null) workoutCounts[wid] = 0;
        });

        let most: { workoutId: string; title: string; count: number } | null =
          null;
        let least: { workoutId: string; title: string; count: number } | null =
          null;
        Object.entries(workoutCounts).forEach(([wid, count]) => {
          const title = workoutTitleById[wid] ?? "Workout";
          if (!most || count > most.count)
            most = { workoutId: wid, title, count };
          if (!least || count < least.count)
            least = { workoutId: wid, title, count };
        });

        const biggestSession =
          biggestSessionWorkoutId != null
            ? {
                workoutId: biggestSessionWorkoutId,
                title: workoutTitleById[biggestSessionWorkoutId] ?? "Workout",
                volume: biggestSessionVolume,
              }
            : null;

        // Weekly histogram
        const weeklyCounts: Record<string, number> = {};
        planSessRows.forEach((s) => {
          const wk = weekStartKeySunday(s.completed_at);
          weeklyCounts[wk] = (weeklyCounts[wk] ?? 0) + 1;
        });

        const weeklySessions = Object.keys(weeklyCounts)
          .sort((a, b) => a.localeCompare(b))
          .map((wk) => ({ week: wk, count: weeklyCounts[wk] }));

        // Goal summaries (completed view)
        const goalSummaries: Stats["goalSummaries"] = [];
        const exerciseGoals = (gData ?? [])
          .filter((g: any) => g?.exercises?.id)
          .slice(0, 3);

        if (exerciseGoals.length) {
          const ids = exerciseGoals.map((g: any) => String(g.exercises.id));
          const latestByExercise: Record<string, number> = {};

          timeSessRows.forEach((row) => {
            (row.workout_exercise_history ?? []).forEach((eh) => {
              const exId = eh.exercise_id;
              if (!ids.includes(exId)) return;

              const g = exerciseGoals.find(
                (x: any) => String(x.exercises.id) === exId
              );
              if (!g) return;

              const sets = eh.workout_set_history ?? [];
              if (!sets.length) return;

              let rawVal = 0;
              switch (g.type) {
                case "exercise_weight":
                  rawVal = Math.max(
                    ...sets.map((s: any) => Number(s.weight ?? 0))
                  );
                  break;
                case "exercise_reps":
                  rawVal = Math.max(
                    ...sets.map((s: any) => Number(s.reps ?? 0))
                  );
                  break;
                case "distance":
                  rawVal = sets.reduce(
                    (sum: number, s: any) => sum + Number(s.distance ?? 0),
                    0
                  );
                  break;
                case "time":
                  rawVal = sets.reduce(
                    (sum: number, s: any) => sum + Number(s.time_seconds ?? 0),
                    0
                  );
                  break;
                default:
                  rawVal = 0;
              }
              latestByExercise[exId] = rawVal;
            });
          });

          exerciseGoals.forEach((g: any) => {
            const exId = String(g.exercises.id);
            const name = String(g.exercises.name ?? "Goal exercise");
            const target = Number(g.target_number ?? 0);
            const startParsed = parseStart(g.notes);
            const start = typeof startParsed === "number" ? startParsed : 0;

            const actual =
              latestByExercise[exId] !== undefined
                ? latestByExercise[exId]
                : start;

            const denom = target - start;
            const progress =
              denom > 0
                ? clamp01((actual - start) / denom)
                : actual >= target
                ? 1
                : 0;

            const label =
              g.type === "exercise_weight" || g.type === "exercise_reps"
                ? `${Math.round(actual)} / ${Math.round(target)}`
                : g.type === "distance"
                ? `${actual.toFixed(1)} / ${target.toFixed(1)}`
                : g.type === "time"
                ? `${Math.round(actual)}s / ${Math.round(target)}s`
                : `${actual} / ${target}`;

            goalSummaries.push({
              id: String(g.id),
              name,
              type: String(g.type),
              progress,
              label,
            });
          });
        }

        const avgVolumePerSession =
          sessionsCompleted > 0 ? totalVolume / sessionsCompleted : 0;

        if (!cancelled) {
          setStats({
            plannedWorkouts,
            sessionsPlanned,
            sessionsCompleted,
            sessionsMissed,
            uniqueWorkoutsHit,
            missedWorkouts,

            totalSets,
            totalReps,
            totalVolume,
            totalTimeSeconds,

            weeklySessions,

            bestSet,
            topExerciseBySets,
            mostImproved,

            workoutCounts: { most, least },
            biggestSession,

            goalSummaries,
            consistencyPct,
            avgVolumePerSession,
          });
        }
      } catch (e) {
        console.warn("plan history view load error:", e);
        if (!cancelled) {
          setPlan(null);
          setPlanWorkouts([]);
          setPlanSessions([]);
          setGoals([]);
          setStats(null);
          setWorkoutsWithExercises([]);
          setHasActivePlanNow(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, planId]);

  // --- Weekly completion state for ACTIVE plan ---
  // If you already have a backend signal, swap this condition to use it.
  const weeklyTarget = Number(plan?.weekly_target_sessions ?? 0);
  const sessionsThisWeek = useMemo(() => {
    // Count plan sessions in current (Sunday-start) week.
    // (Keeps behaviour consistent with your weekStartKeySunday helper.)
    const now = new Date();
    const todayIso = now.toISOString();
    const wk = weekStartKeySunday(todayIso);

    let count = 0;
    for (const s of planSessions) {
      if (weekStartKeySunday(s.completed_at) === wk) count += 1;
    }
    return count;
  }, [planSessions]);

  const weekCompleteActive =
    isActivePlan && weeklyTarget > 0 && sessionsThisWeek >= weeklyTarget;

  const planProgressPct = useMemo(() => {
    // Lightweight overall progress for the header ring in both states:
    // sessions completed vs sessions planned (fallback).
    const denom = Math.max(1, stats?.sessionsPlanned ?? 0);
    const pct = (stats?.sessionsCompleted ?? planSessions.length) / denom;
    return clamp01(pct) * 100;
  }, [stats, planSessions.length]);

  function pickGoalExtremes(goals: Stats["goalSummaries"] | null | undefined): {
    closest: Stats["goalSummaries"][number] | null;
    furthest: Stats["goalSummaries"][number] | null;
  } {
    const list = (goals ?? []).filter((g) => Number.isFinite(g.progress));
    if (!list.length) return { closest: null, furthest: null };

    const sorted = [...list].sort((a, b) => b.progress - a.progress);
    return {
      closest: sorted[0] ?? null,
      furthest: sorted[sorted.length - 1] ?? null,
    };
  }

  function suggestGoalTweakLabel(goal: Stats["goalSummaries"][number] | null) {
    if (!goal) return null;

    const p = clamp01(goal.progress);
    // Heuristic: if they’re close, bump next target; if far, shrink the jump.
    if (p >= 0.85) {
      if (goal.type === "exercise_weight") return "Next target: +2.5–5 kg";
      if (goal.type === "exercise_reps") return "Next target: +1–2 reps";
      if (goal.type === "distance") return "Next target: +0.5–1.0 km";
      if (goal.type === "time") return "Next target: +30–60s";
      return "Next target: small increase";
    }

    if (p <= 0.35) {
      if (goal.type === "exercise_weight")
        return "Tip: smaller jump (+1–2.5 kg)";
      if (goal.type === "exercise_reps") return "Tip: smaller jump (+1 rep)";
      if (goal.type === "distance") return "Tip: build in smaller steps";
      if (goal.type === "time") return "Tip: build in smaller steps";
      return "Tip: reduce the jump";
    }

    return "Keep pushing — steady progress";
  }

  const personalisedInsights = useMemo(() => {
    if (!stats) return null;

    // ---- A (3): verdict + keep + fix ----
    const completed = stats.sessionsCompleted ?? 0;
    const planned = Math.max(1, stats.sessionsPlanned ?? 0);
    const pct = clamp01(completed / planned);
    const pctLabel = `${Math.round(pct * 100)}%`;

    // Verdict copy — short and punchy
    let verdictTitle = "Consistency";
    let verdictBody = `${completed}/${planned} sessions (${pctLabel})`;

    if (pct >= 0.9)
      verdictBody = `${completed}/${planned} sessions (${pctLabel}) — elite consistency`;
    else if (pct >= 0.75)
      verdictBody = `${completed}/${planned} sessions (${pctLabel}) — strong`;
    else if (pct >= 0.5)
      verdictBody = `${completed}/${planned} sessions (${pctLabel}) — decent, room to improve`;
    else
      verdictBody = `${completed}/${planned} sessions (${pctLabel}) — next plan should be easier to stick to`;

    const keep =
      stats.workoutCounts?.most && stats.workoutCounts.most.count > 0
        ? `Keep: ${stats.workoutCounts.most.title} (${stats.workoutCounts.most.count}×)`
        : null;

    const fix = stats.workoutCounts?.least
      ? `Fix: ${stats.workoutCounts.least.title} (${stats.workoutCounts.least.count}×) — shorten it or move it earlier in the week`
      : null;

    // ---- B (2): biggest session implication ----
    const biggest =
      stats.biggestSession && stats.biggestSession.volume > 0
        ? {
            title: `Biggest session: ${stats.biggestSession.title}`,
            body: `${Math.round(
              stats.biggestSession.volume
            )} kg volume — this is where you pushed hardest, ensure this continues.`,
          }
        : null;

    // ---- C (3): goal extremes + suggestion ----
    const { closest, furthest } = pickGoalExtremes(stats.goalSummaries);
    const closestLine = closest
      ? `Closest goal: ${closest.name} (${Math.round(
          clamp01(closest.progress) * 100
        )}%)`
      : null;

    const furthestLine = furthest
      ? `Furthest goal: ${furthest.name} (${Math.round(
          clamp01(furthest.progress) * 100
        )}%)`
      : null;

    const tweakLine = suggestGoalTweakLabel(closest ?? furthest);

    // We’ll return three grouped “rows” so the UI can render cleanly.
    return {
      a: {
        title: verdictTitle,
        body: verdictBody,
        keep,
        fix,
      },
      b: biggest,
      c: {
        closestLine,
        furthestLine,
        tweakLine,
      },
    };
  }, [stats]);

  return (
    <Screen>
      <ScreenHeader
        title={isActivePlan ? "Active plan" : "Plan history"}
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.space.md,
          paddingBottom: layout.space.xl,
          gap: layout.space.md,
        }}
      >
        <Card>
          {loading ? (
            <View
              style={{ paddingVertical: layout.space.md, alignItems: "center" }}
            >
              <ActivityIndicator />
            </View>
          ) : !plan ? (
            <Text style={styles.muted}>Plan not found.</Text>
          ) : (
            <View style={{ gap: layout.space.sm }}>
              {/* Title + status */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={2}>
                    {plan.title ?? "Plan"}
                  </Text>

                  <Text style={styles.muted}>
                    {plan.start_date ?? "—"} → {plan.end_date ?? "—"}
                  </Text>

                  {!isActivePlan ? (
                    <Text style={styles.muted}>
                      Completed: {formatLongDate(plan.completed_at)}
                    </Text>
                  ) : null}
                </View>

                <View style={{ alignItems: "flex-end", gap: layout.space.xs }}>
                  <MiniRing valuePct={planProgressPct} size={44} stroke={6} />
                </View>
              </View>

              {/* ACTIVE PLAN — week complete message */}
              {weekCompleteActive ? (
                <View style={styles.restBox}>
                  <Text style={styles.restTitle}>
                    You’ve completed your workouts for the week
                  </Text>
                  <Text style={styles.muted}>
                    Time to rest and recover — come back fresh for the next
                    week.
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </Card>

        {/* ACTIVE PLAN VIEW */}
        {!loading && plan && isActivePlan ? (
          <>
            <Card>
              <View style={{ gap: layout.space.sm }}>
                <Text style={styles.sectionLabel}>Where you’re at</Text>
                <Text style={styles.muted}>
                  Keep logging sessions — this screen becomes the full breakdown
                  once the plan is completed.
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    gap: layout.space.sm,
                    flexWrap: "wrap",
                  }}
                >
                  <Pill
                    label={`Workouts: ${planWorkouts.length}`}
                    tone="neutral"
                  />
                  <Pill
                    label={`Sessions logged: ${planSessions.length}`}
                    tone="neutral"
                  />
                  {weeklyTarget > 0 ? (
                    <Pill
                      label={`This week: ${sessionsThisWeek}/${weeklyTarget}`}
                      tone={weekCompleteActive ? "success" : "neutral"}
                    />
                  ) : null}
                </View>
              </View>
            </Card>

            <Card>
              <View style={{ gap: layout.space.sm }}>
                <Text style={styles.sectionLabel}>Goals</Text>

                {activeGoalSummaries.length ? (
                  <View style={{ gap: layout.space.sm }}>
                    {activeGoalSummaries.map((g) => (
                      <View key={g.id} style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {g.name}
                          </Text>
                          <Text style={styles.muted}>{g.label}</Text>
                        </View>
                        <Pill
                          label={`${Math.round(clamp01(g.progress) * 100)}%`}
                          tone="neutral"
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    No goals added to this plan yet.
                  </Text>
                )}
              </View>
            </Card>

            <Card>
              <View style={{ gap: layout.space.sm }}>
                <Text style={styles.sectionLabel}>Workouts</Text>

                {workoutsWithExercises.length ? (
                  <View style={{ gap: layout.space.md }}>
                    {workoutsWithExercises.map((w) => (
                      <View key={w.id} style={styles.block}>
                        <Text style={styles.headerRow} numberOfLines={1}>
                          {w.title}
                        </Text>

                        {w.exercises.length ? (
                          <View style={{ gap: layout.space.sm }}>
                            {w.exercises.map((ex) => {
                              const last = lastSetByExercise[ex.id];
                              return (
                                <View key={ex.id} style={styles.row}>
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={styles.rowTitle}
                                      numberOfLines={1}
                                    >
                                      {ex.name}
                                    </Text>
                                    <Text
                                      style={styles.muted}
                                      numberOfLines={1}
                                    >
                                      Last set:{" "}
                                      <Text style={styles.strong}>
                                        {formatLastSet(last?.set)}
                                      </Text>
                                      {last?.completed_at
                                        ? ` · ${formatLongDate(
                                            last.completed_at
                                          )}`
                                        : ""}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          <Text style={styles.muted}>
                            No exercises in this workout yet.
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    No workouts found for this plan.
                  </Text>
                )}
              </View>
            </Card>

            {/* Optional: if weekCompleteActive, hide the “start next” CTA elsewhere in your app */}
          </>
        ) : null}

        {/* COMPLETED PLAN VIEW */}
        {!loading && plan && !isActivePlan ? (
          <>
            <Card>
              <View style={{ gap: layout.space.md }}>
                <Text style={styles.sectionLabel}>Overview</Text>

                <View style={{ flexDirection: "row", gap: layout.space.sm }}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Planned</Text>
                    <Text style={styles.kpiValue}>
                      {stats?.sessionsPlanned ?? 0}
                    </Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Completed</Text>
                    <Text style={styles.kpiValue}>
                      {stats?.sessionsCompleted ?? 0}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: layout.space.sm }}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Missed</Text>
                    <Text style={styles.kpiValue}>
                      {stats?.sessionsMissed ?? 0}
                    </Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Consistency</Text>
                    <Text style={styles.kpiValue}>
                      {Math.round((stats?.consistencyPct ?? 0) * 100)}%
                    </Text>
                  </View>
                </View>

                {showStartNewPlanCta ? (
                  <View style={{ alignItems: "center" }}>
                    <Animated.View
                      style={{
                        transform: [{ scale: ctaScale }],
                        width: "100%",
                      }}
                    >
                      <Pressable
                        onPress={() =>
                          router.push("/features/plans/create/planInfo")
                        }
                        onPressIn={pressIn}
                        onPressOut={pressOut}
                        style={styles.primaryCta}
                      >
                        <Text style={styles.primaryCtaText}>
                          Start a new plan
                        </Text>
                      </Pressable>
                    </Animated.View>
                  </View>
                ) : null}
              </View>
            </Card>

            <Card>
              <View style={{ gap: layout.space.sm }}>
                <Text style={styles.sectionLabel}>You improved most in</Text>

                <View style={styles.block}>
                  <Text style={styles.kpiLabel}>Strength</Text>
                  <Text style={styles.bigValue} numberOfLines={2}>
                    {stats?.mostImproved?.name ?? "—"}
                  </Text>
                  <Text style={styles.muted}>
                    {stats?.mostImproved?.from && stats?.mostImproved?.to
                      ? `${Math.round(
                          stats.mostImproved.from.weight
                        )} × ${Math.round(
                          stats.mostImproved.from.reps
                        )} → ${Math.round(
                          stats.mostImproved.to.weight
                        )} × ${Math.round(
                          stats.mostImproved.to.reps
                        )} (+${Math.round(
                          (stats.mostImproved.pct ?? 0) * 100
                        )}%)`
                      : "No improvement data yet."}
                  </Text>
                </View>

                <View style={styles.block}>
                  <Text style={styles.kpiLabel}>Consistency</Text>
                  <Text style={styles.bigValue}>
                    {Math.round((stats?.consistencyPct ?? 0) * 100)}%
                  </Text>
                  <Text style={styles.muted}>
                    {stats?.sessionsCompleted ?? 0} /{" "}
                    {stats?.sessionsPlanned ?? 0} sessions
                  </Text>
                  <Text style={styles.muted}>
                    Most:{" "}
                    <Text style={styles.strong}>
                      {stats?.workoutCounts?.most
                        ? `${stats.workoutCounts.most.title} (${stats.workoutCounts.most.count})`
                        : "—"}
                    </Text>
                  </Text>
                  <Text style={styles.muted}>
                    Least:{" "}
                    <Text style={styles.strong}>
                      {stats?.workoutCounts?.least
                        ? `${stats.workoutCounts.least.title} (${stats.workoutCounts.least.count})`
                        : "—"}
                    </Text>
                  </Text>
                </View>

                <View style={styles.block}>
                  <Text style={styles.kpiLabel}>Volume</Text>
                  <Text style={styles.bigValue}>
                    {stats ? `${Math.round(stats.totalVolume)} kg` : "0 kg"}
                  </Text>
                  <Text style={styles.muted}>
                    Avg{" "}
                    {stats
                      ? `${Math.round(stats.avgVolumePerSession)} kg`
                      : "0 kg"}{" "}
                    / session
                  </Text>
                  <Text style={styles.muted}>
                    Biggest session:{" "}
                    <Text style={styles.strong}>
                      {stats?.biggestSession
                        ? `${stats.biggestSession.title} · ${Math.round(
                            stats.biggestSession.volume
                          )} kg`
                        : "—"}
                    </Text>
                  </Text>
                </View>
              </View>
            </Card>

            <Card>
              <View style={{ gap: layout.space.md }}>
                <Text style={styles.sectionLabel}>Totals</Text>

                <View style={{ flexDirection: "row", gap: layout.space.sm }}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Total volume</Text>
                    <Text style={styles.kpiValue}>
                      {Math.round(stats?.totalVolume ?? 0)} kg
                    </Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Total time</Text>
                    <Text style={styles.kpiValue}>
                      {secondsToHhMm(stats?.totalTimeSeconds ?? 0)}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: layout.space.sm }}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Total sets</Text>
                    <Text style={styles.kpiValue}>{stats?.totalSets ?? 0}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiLabel}>Total reps</Text>
                    <Text style={styles.kpiValue}>{stats?.totalReps ?? 0}</Text>
                  </View>
                </View>
              </View>
            </Card>

            <Card>
              <View style={{ gap: layout.space.sm }}>
                <Text style={styles.sectionLabel}>Weekly consistency</Text>

                {stats?.weeklySessions?.length ? (
                  <View
                    onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
                    style={{ width: "100%" }}
                  >
                    {chartWidth > 0 ? (
                      <MiniBarChart
                        width={chartWidth}
                        values={stats.weeklySessions.map((w) => w.count)}
                        fill={colors.text ?? colors.text}
                      />
                    ) : null}

                    <Text style={styles.muted}>
                      {stats.weeklySessions.length} training week
                      {stats.weeklySessions.length === 1 ? "" : "s"} logged
                      during this plan.
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.muted}>No sessions recorded.</Text>
                )}
              </View>
            </Card>

            <Card>
              <View style={{ gap: layout.space.sm }}>
                <Text style={styles.sectionLabel}>Goal progress</Text>

                {stats?.goalSummaries?.length ? (
                  <View style={{ gap: layout.space.sm }}>
                    {stats.goalSummaries.map((g) => (
                      <View key={g.id} style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {g.name}
                          </Text>
                          <Text style={styles.muted}>{g.label}</Text>
                        </View>
                        <Pill
                          label={`${Math.round(clamp01(g.progress) * 100)}%`}
                          tone="neutral"
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    No plan goals found for this plan.
                  </Text>
                )}
              </View>
            </Card>

            <Card>
              <View style={{ gap: layout.space.sm }}>
                <Text style={styles.sectionLabel}>Personalised insights</Text>

                {!personalisedInsights ? (
                  <Text style={styles.muted}>No insights available yet.</Text>
                ) : (
                  <View style={{ gap: layout.space.sm }}>
                    {/* A (3): Consistency verdict + Keep + Fix */}
                    <View style={styles.block}>
                      <Text style={styles.rowTitle}>Consistency</Text>
                      <Text style={styles.muted}>
                        {personalisedInsights.a.body}
                      </Text>

                      {personalisedInsights.a.keep ? (
                        <Text style={styles.muted}>
                          <Text style={styles.strong}>
                            {personalisedInsights.a.keep}
                          </Text>
                        </Text>
                      ) : null}

                      {personalisedInsights.a.fix ? (
                        <Text style={styles.muted}>
                          <Text style={styles.strong}>
                            {personalisedInsights.a.fix}
                          </Text>
                        </Text>
                      ) : null}
                    </View>

                    {/* B (2): Biggest session + implication */}
                    {personalisedInsights.b ? (
                      <View style={styles.block}>
                        <Text style={styles.rowTitle}>
                          {personalisedInsights.b.title}
                        </Text>
                        <Text style={styles.muted}>
                          {personalisedInsights.b.body}
                        </Text>
                      </View>
                    ) : null}

                    {/* C (3): Closest + Furthest + Suggested tweak */}
                    <View style={styles.block}>
                      <Text style={styles.rowTitle}>Goals</Text>

                      {personalisedInsights.c.closestLine ? (
                        <Text style={styles.muted}>
                          <Text style={styles.strong}>
                            {personalisedInsights.c.closestLine}
                          </Text>
                        </Text>
                      ) : (
                        <Text style={styles.muted}>
                          No goals were tracked in this plan.
                        </Text>
                      )}

                      {personalisedInsights.c.furthestLine &&
                      personalisedInsights.c.furthestLine !==
                        personalisedInsights.c.closestLine ? (
                        <Text style={styles.muted}>
                          {personalisedInsights.c.furthestLine}
                        </Text>
                      ) : null}

                      {personalisedInsights.c.tweakLine ? (
                        <View style={{ marginTop: 4 }}>
                          <Pill
                            label={personalisedInsights.c.tweakLine}
                            tone="neutral"
                          />
                        </View>
                      ) : null}
                    </View>

                    {/* Optional CTA (only when you already show it elsewhere, keep it minimal) */}
                    {showStartNewPlanCta ? (
                      <View style={{ marginTop: 2 }}>
                        <Text style={styles.muted}>
                          Use these insights to make your next plan easier to
                          stick to.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      gap: layout.space.md,
      alignItems: "flex-start",
      justifyContent: "space-between",
    },

    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      color: colors.text,
      letterSpacing: -0.2,
    },

    sectionLabel: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: "uppercase",
    },

    muted: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    strong: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
    },

    restBox: {
      marginTop: layout.space.sm,
      padding: layout.space.md,
      borderRadius: layout.radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 6,
    },

    restTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },

    kpi: {
      flex: 1,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: layout.space.md,
      gap: 6,
    },

    kpiLabel: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    kpiValue: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      color: colors.text,
      letterSpacing: -0.2,
    },

    bigValue: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      color: colors.text,
    },

    block: {
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: layout.space.md,
      gap: 6,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
    },

    rowTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },

    primaryCta: {
      width: "100%",
      paddingVertical: 14,
      borderRadius: layout.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryBg ?? colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    primaryCtaText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },
  });
