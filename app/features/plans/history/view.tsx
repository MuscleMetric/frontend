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
import { useAuth } from "../../../../lib/useAuth";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { SectionCard } from "../../../_components";
import Svg, { Rect } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

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

  // Best set overall
  bestSet: BestSet | null;

  // Top exercise by SETS (not volume)
  topExerciseBySets: { exerciseId: string; name: string; sets: number } | null;

  // Strength improvement details (first -> best + %)
  mostImproved: {
    exerciseId: string;
    name: string;
    from: { weight: number; reps: number; completed_at: string } | null;
    to: { weight: number; reps: number; completed_at: string } | null;
    pct: number; // 0..1
  } | null;

  // Consistency most/least completed workout in plan
  workoutCounts: {
    most: { workoutId: string; title: string; count: number } | null;
    least: { workoutId: string; title: string; count: number } | null;
  };

  // Biggest volume session
  biggestSession: { workoutId: string; title: string; volume: number } | null;

  goalSummaries: Array<{
    id: string;
    name: string;
    type: string;
    progress: number; // 0..1
    label: string;
  }>;

  consistencyPct: number; // 0..1
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
    return d.toLocaleDateString("en-US", {
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
  const days = Math.floor(ms / 86400000) + 1; // inclusive
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

  // weights/reps
  if ((reps != null && reps > 0) || (weight != null && weight > 0)) {
    const w = weight != null ? Math.round(weight) : 0;
    const r = reps != null ? Math.round(reps) : 0;
    if (w > 0 && r > 0) return `${w} × ${r}`;
    if (w > 0) return `${w} kg`;
    if (r > 0) return `${r} reps`;
  }

  // cardio-ish
  if (dist != null && dist > 0) return `${dist.toFixed(1)} km`;
  if (time != null && time > 0) return secondsToHhMm(time);

  return "—";
}

export default function PlanHistoryViewScreen() {
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanRow | null>(null);

  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkoutRow[]>([]);
  const [planSessions, setPlanSessions] = useState<SessionRow[]>([]);
  const [timeSessions, setTimeSessions] = useState<SessionRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [chartWidth, setChartWidth] = useState(0);

  // extra for active view
  const [workoutsWithExercises, setWorkoutsWithExercises] = useState<
    WorkoutWithExercises[]
  >([]);

  // CTA rule: only show “Start a new plan” if user has NO active plan now
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

  // Map: exerciseId -> last set from the most recent session that included the exercise
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

    // sessions are fetched ascending currently; easiest is iterate from end (most recent)
    for (let i = timeSessions.length - 1; i >= 0; i--) {
      const sess = timeSessions[i];
      for (const eh of sess.workout_exercise_history ?? []) {
        const exId = eh.exercise_id;
        if (out[exId]) continue; // already have the most recent occurrence
        const sets = eh.workout_set_history ?? [];
        const lastSet = sets.length ? sets[sets.length - 1] : null;
        out[exId] = {
          completed_at: sess.completed_at,
          set: lastSet,
        };
      }
    }
    return out;
  }, [timeSessions]);

  // For the active plan “where you’re at” goals section (simple summary)
  const activeGoalSummaries = useMemo(() => {
    // only show exercise-linked goals in active view (keeps it clean)
    const exerciseGoals = goals.filter((g) => g?.exercises?.id).slice(0, 6);

    if (!exerciseGoals.length) return [];

    const byExercise: Record<string, number> = {};

    // compute latest value per exercise based on most recent session (so it feels “current”)
    for (let i = timeSessions.length - 1; i >= 0; i--) {
      const sess = timeSessions[i];
      for (const eh of sess.workout_exercise_history ?? []) {
        const exId = eh.exercise_id;
        if (byExercise[exId] != null) continue; // already got newest
        const sets = eh.workout_set_history ?? [];
        if (!sets.length) continue;

        // choose goal type for this exercise if exists
        const g = exerciseGoals.find((x) => String(x.exercises?.id) === exId);
        if (!g) continue;

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

      return {
        id: g.id,
        name,
        type: g.type,
        progress,
        label,
      };
    });
  }, [goals, planSessions]);

  useEffect(() => {
    if (!userId || !planId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // reset screen-specific state every load
        if (!cancelled) {
          setWorkoutsWithExercises([]);
          setStats(null);
        }

        // 0) check if user currently has an active plan (new plan already started)
        const { data: activeNow, error: activeErr } = await supabase
          .from("plans")
          .select("id")
          .eq("user_id", userId)
          .eq("is_completed", false)
          .limit(1)
          .maybeSingle();

        if (!cancelled) setHasActivePlanNow(!!activeNow && !activeErr);

        // 1) plan
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

        console.log("[PlanHistory] plan", {
          id: p?.id,
          title: p?.title,
          start_date: p?.start_date,
          end_date: p?.end_date,
          completed_at: p?.completed_at,
          is_completed: p?.is_completed,
          weekly_target_sessions: p?.weekly_target_sessions,
        });

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
          ? pwRows.filter((r) => !r.is_archived) // active plan: hide archived
          : pwRows; // completed plan: include everything

        setPlanWorkouts(visiblePw);

        const workoutTitleById: Record<string, string> = {};
        visiblePw.forEach((w) => {
          workoutTitleById[w.workout_id] = String(w.title ?? "Workout");
        });

        const workoutIds = visiblePw.map((r) => r.workout_id).filter(Boolean);
        const plannedWorkouts = workoutIds.length;

        console.log("[PlanHistory] pw visibility", {
          isPlanActive,
          total: pwRows.length,
          visible: visiblePw.length,
          workoutIds,
        });

        // read weekly goal fallback if needed
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

        // plan boundaries
        const lower = p.start_date ?? null;
        // For active plans, allow up to "now" so sessions load even if end_date is in the future
        const upperExclusive = (() => {
          if (p.completed_at) return null; // we’ll use lte with completed_at timestamp
          if (p.is_completed && p.end_date) {
            const d = new Date(p.end_date + "T00:00:00.000Z");
            d.setUTCDate(d.getUTCDate() + 1); // next day
            return d.toISOString(); // use .lt()
          }
          return null;
        })();

        const start = lower ?? "1970-01-01";
        const endTs = p.completed_at
          ? p.completed_at
          : upperExclusive
          ? upperExclusive
          : new Date().toISOString();

        console.log("[PlanHistory] bounds", {
          lower,
          completed_at: p.completed_at,
          end_date: p.end_date,
          is_completed: p.is_completed,
          upperExclusive,
          now: new Date().toISOString(),
        });

        // 2) goals linked to this plan
        const { data: gData, error: gErr } = await supabase
          .from("goals")
          .select(
            "id, type, target_number, notes, is_active, exercises(id, name)"
          )
          .eq("user_id", userId)
          .eq("plan_id", p.id)
          .order("created_at", { ascending: true })
          .limit(24);

        if (gErr) {
          // not fatal; still show workouts etc
          console.warn("goals load error:", gErr);
        }

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

        // 3) sessions with nested set data
        let planSessRows: SessionRow[] = [];

        if (workoutIds.length) {
          let qPlan = supabase
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

          const { data: sData, error: sErr } = await qPlan;
          if (sErr) throw sErr;

          planSessRows = Array.isArray(sData) ? mapSessions(sData) : [];
        }

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

        // 3b) For ACTIVE plan: also fetch workout -> exercises to show list
        // (we do this for completed too, but you mainly asked for active)
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

            // Keep same order as plan_workouts
            const orderIndex: Record<string, number> = {};
            workoutIds.forEach((id, idx) => (orderIndex[id] = idx));
            mapped.sort(
              (a, b) => (orderIndex[a.id] ?? 0) - (orderIndex[b.id] ?? 0)
            );

            setWorkoutsWithExercises(mapped);
          }
        }

        // 4) compute stats (still useful for completed; lightweight for active)
        const sessionsCompleted = planSessRows.length;

        // sessions planned = weeks * workoutsPerWeek (only meaningful if end_date exists)
        const startForWeeks = p.start_date ?? lower ?? "1970-01-01";
        const endForWeeks = (p.end_date ??
          (p.is_completed ? upperExclusive : null)) as string | null;

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

        // unique workouts hit
        let uniqueWorkoutsHit = 0;
        if (workoutIds.length) {
          const { data: uniq } = await supabase
            .from("workout_history")
            .select("workout_id")
            .eq("user_id", userId)
            .in("workout_id", workoutIds)
            .gte("completed_at", lower ?? "1970-01-01")
            .lte("completed_at", upperExclusive);

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

        const volumeByExercise: Record<string, number> = {};

        const firstBestWeightByExercise: Record<string, number> = {};
        const lastBestWeightByExercise: Record<string, number> = {};

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

              // best set per exercise across plan (by weight)
              const existing = bestSetByExercise[exId];
              if (!existing || weight > existing.weight) {
                bestSetByExercise[exId] = {
                  weight,
                  reps,
                  completed_at: sess.completed_at,
                };
              }
            });

            // first "best set we saw for this exercise" (uses the best set in this session)
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

        // Best single set across all exercises (force correct typing)
        type BestByExercise = {
          weight: number;
          reps: number;
          completed_at: string;
        };

        const entries = Object.entries(bestSetByExercise) as Array<
          [string, BestByExercise]
        >;

        let bestSet: BestSet | null = null;

        for (const [exId, br] of entries) {
          const currentBest = bestSet ? bestSet.weight : -1;

          if (!bestSet || br.weight > currentBest) {
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

        // Top exercise by volume
        let topExerciseId: string | null = null;
        let topVol = 0;
        Object.entries(volumeByExercise).forEach(([exId, vol]) => {
          if (vol > topVol) {
            topVol = vol;
            topExerciseId = exId;
          }
        });

        // Most improved by best weight delta
        let bestDelta = 0;
        let bestDeltaExerciseId: string | null = null;
        Object.keys(lastBestWeightByExercise).forEach((exId) => {
          const a = Number(firstBestWeightByExercise[exId] ?? 0);
          const b = Number(lastBestWeightByExercise[exId] ?? 0);
          const delta = b - a;
          if (delta > bestDelta) {
            bestDelta = delta;
            bestDeltaExerciseId = exId;
          }
        });

        let topExerciseSetsId: string | null = null;
        let topSets = 0;

        Object.entries(setsByExercise).forEach(([exId, c]) => {
          if (c > topSets) {
            topSets = c;
            topExerciseSetsId = exId;
          }
        });

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

        // Resolve names for only the IDs we need
        const needIds: string[] = [];
        if (bestSet) needIds.push(bestSet.exerciseId);
        if (topExerciseSetsId) needIds.push(topExerciseSetsId);
        if (bestImprovedId) needIds.push(bestImprovedId);

        const uniqueNeedIds = Array.from(new Set(needIds));

        let nameById: Record<string, string> = {};
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

        const workoutCounts: Record<string, number> = {};
        planSessRows.forEach((s) => {
          const wid = s.workout_id;
          if (!wid) return;
          workoutCounts[wid] = (workoutCounts[wid] ?? 0) + 1;
        });

        // ensure we consider workouts that were in plan but maybe never completed
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

        // Goal summaries (completed-plan section)
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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingTop: 10,
          paddingHorizontal: 16,
          paddingBottom: 32,
          gap: 12,
        }}
      >
        {/* Header: back left + centered title */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>

          <Text style={styles.heading} numberOfLines={1}>
            {isActivePlan ? "Active plan" : "Plan history"}
          </Text>

          {/* right spacer so title stays centered */}
          <View style={styles.rightSpacer} />
        </View>

        <SectionCard>
          {loading ? (
            <View style={{ paddingVertical: 14 }}>
              <ActivityIndicator />
            </View>
          ) : !plan ? (
            <Text style={styles.subtle}>Plan not found.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{plan.title ?? "Plan"}</Text>
                <View
                  style={[
                    styles.statusPill,
                    isActivePlan
                      ? styles.statusPillActive
                      : styles.statusPillDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isActivePlan
                        ? styles.statusTextActive
                        : styles.statusTextDone,
                    ]}
                  >
                    {isActivePlan ? "Active" : "Completed"}
                  </Text>
                </View>
              </View>

              <Text style={styles.subtle}>
                {plan.start_date ?? "—"} → {plan.end_date ?? "—"}
              </Text>

              {!isActivePlan && (
                <Text style={styles.subtle}>
                  Completed: {formatLongDate(plan.completed_at)}
                </Text>
              )}

              {/* ACTIVE PLAN VIEW */}
              {isActivePlan ? (
                <View style={{ gap: 12 }}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>Where you’re at</Text>
                    <Text style={styles.subtle}>
                      Keep logging sessions — this screen will become the full
                      plan breakdown once the plan is completed.
                    </Text>

                    <View style={{ marginTop: 10, gap: 6 }}>
                      <Text style={styles.kpiLine}>
                        Workouts in plan:{" "}
                        <Text style={styles.kpiStrong}>
                          {planWorkouts.length}
                        </Text>
                      </Text>
                      <Text style={styles.kpiLine}>
                        Sessions logged so far:{" "}
                        <Text style={styles.kpiStrong}>
                          {planSessions.length}
                        </Text>
                      </Text>
                    </View>
                  </View>

                  {/* Active goals */}
                  <View style={styles.sectionBox}>
                    <Text style={styles.sectionTitle}>Goals</Text>

                    {activeGoalSummaries.length ? (
                      <View style={{ gap: 10 }}>
                        {activeGoalSummaries.map((g) => (
                          <View key={g.id} style={styles.goalRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.goalName} numberOfLines={1}>
                                {g.name}
                              </Text>
                              <Text style={styles.subtle}>{g.label}</Text>
                            </View>
                            <View style={styles.goalPill}>
                              <Text style={styles.goalPillText}>
                                {Math.round(clamp01(g.progress) * 100)}%
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.subtle}>
                        No goals added to this plan yet.
                      </Text>
                    )}
                  </View>

                  {/* Workouts + exercises + last set */}
                  <View style={styles.sectionBox}>
                    <Text style={styles.sectionTitle}>Workouts</Text>

                    {workoutsWithExercises.length ? (
                      <View style={{ gap: 12 }}>
                        {workoutsWithExercises.map((w) => (
                          <View key={w.id} style={styles.workoutBlock}>
                            <Text style={styles.workoutTitle} numberOfLines={1}>
                              {w.title}
                            </Text>

                            {w.exercises.length ? (
                              <View style={{ gap: 8 }}>
                                {w.exercises.map((ex) => {
                                  const last = lastSetByExercise[ex.id];
                                  return (
                                    <View
                                      key={ex.id}
                                      style={styles.exerciseRow}
                                    >
                                      <View style={{ flex: 1 }}>
                                        <Text
                                          style={styles.exerciseName}
                                          numberOfLines={1}
                                        >
                                          {ex.name}
                                        </Text>
                                        <Text
                                          style={styles.subtle}
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
                              <Text style={styles.subtle}>
                                No exercises in this workout yet.
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.subtle}>
                        No workouts found for this plan.
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                /* COMPLETED PLAN VIEW */
                <View style={{ gap: 12 }}>
                  {/* KPI row: sessions planned/completed/missed */}
                  <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Sessions planned</Text>
                      <Text style={styles.kpiValue}>
                        {stats?.sessionsPlanned ?? 0}
                      </Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Sessions completed</Text>
                      <Text style={styles.kpiValue}>
                        {stats?.sessionsCompleted ?? 0}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Sessions missed</Text>
                      <Text style={styles.kpiValue}>
                        {stats?.sessionsMissed ?? 0}
                      </Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Consistency</Text>
                      <Text style={styles.kpiValue}>
                        {Math.round((stats?.consistencyPct ?? 0) * 100)}%
                      </Text>
                    </View>
                  </View>

                  {showStartNewPlanCta && (
                    <View style={styles.ctaWrap}>
                      <Animated.View
                        style={{ transform: [{ scale: ctaScale }] }}
                      >
                        <Pressable
                          onPress={() =>
                            router.push("/features/plans/create/planInfo")
                          }
                          onPressIn={pressIn}
                          onPressOut={pressOut}
                          style={styles.startPlanCtaBig}
                        >
                          <Text style={styles.startPlanCtaBigText}>
                            Start a new plan →
                          </Text>
                        </Pressable>
                      </Animated.View>
                    </View>
                  )}

                  {/* “You improved most in…” 3-card section */}
                  <View style={styles.sectionBox}>
                    <Text style={styles.sectionTitle}>
                      You improved most in
                    </Text>

                    <View style={styles.improvedStack}>
                      <View style={styles.improvedRowCard}>
                        <Text style={styles.improvedLabel}>Strength</Text>
                        <Text style={styles.improvedValue} numberOfLines={2}>
                          {stats?.mostImproved?.name ?? "—"}
                        </Text>
                        <Text style={styles.subtle}>
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

                      <View style={styles.improvedRowCard}>
                        <Text style={styles.improvedLabel}>Consistency</Text>
                        <Text style={styles.improvedValue}>
                          {Math.round((stats?.consistencyPct ?? 0) * 100)}%
                        </Text>
                        <Text style={styles.subtle}>
                          {stats?.sessionsCompleted ?? 0} /{" "}
                          {stats?.sessionsPlanned ?? 0} sessions
                        </Text>
                        <Text style={styles.subtle}>
                          Most:{" "}
                          <Text style={styles.strong}>
                            {stats?.workoutCounts?.most
                              ? `${stats.workoutCounts.most.title} (${stats.workoutCounts.most.count})`
                              : "—"}
                          </Text>
                        </Text>
                        <Text style={styles.subtle}>
                          Least:{" "}
                          <Text style={styles.strong}>
                            {stats?.workoutCounts?.least
                              ? `${stats.workoutCounts.least.title} (${stats.workoutCounts.least.count})`
                              : "—"}
                          </Text>
                        </Text>
                      </View>

                      <View style={styles.improvedRowCard}>
                        <Text style={styles.improvedLabel}>Volume</Text>
                        <Text style={styles.improvedValue}>
                          {stats
                            ? `${Math.round(stats.totalVolume)} kg`
                            : "0 kg"}
                        </Text>
                        <Text style={styles.subtle}>
                          Avg{" "}
                          {stats
                            ? `${Math.round(stats.avgVolumePerSession)} kg`
                            : "0 kg"}{" "}
                          / session
                        </Text>
                        <Text style={styles.subtle}>
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
                  </View>

                  {/* Totals */}
                  <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Total volume</Text>
                      <Text style={styles.kpiValue}>
                        {Math.round(stats?.totalVolume ?? 0)} kg
                      </Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Total time</Text>
                      <Text style={styles.kpiValue}>
                        {secondsToHhMm(stats?.totalTimeSeconds ?? 0)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Total sets</Text>
                      <Text style={styles.kpiValue}>
                        {stats?.totalSets ?? 0}
                      </Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Total reps</Text>
                      <Text style={styles.kpiValue}>
                        {stats?.totalReps ?? 0}
                      </Text>
                    </View>
                  </View>

                  {/* Weekly consistency chart */}
                  <View style={styles.sectionBox}>
                    <Text style={styles.sectionTitle}>Weekly consistency</Text>
                    {stats?.weeklySessions?.length ? (
                      <View
                        onLayout={(e) =>
                          setChartWidth(e.nativeEvent.layout.width)
                        }
                        style={{ width: "100%" }}
                      >
                        {chartWidth > 0 && (
                          <MiniBarChart
                            width={chartWidth}
                            values={stats.weeklySessions.map((w) => w.count)}
                            fill={colors.primaryText ?? colors.text}
                          />
                        )}

                        <Text style={styles.subtle}>
                          {stats.weeklySessions.length} training week
                          {stats.weeklySessions.length === 1 ? "" : "s"} logged
                          during this plan.
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.subtle}>No sessions recorded.</Text>
                    )}
                  </View>

                  {/* Goals mini */}
                  <View style={styles.sectionBox}>
                    <Text style={styles.sectionTitle}>Goal progress</Text>

                    {stats?.goalSummaries?.length ? (
                      <View style={{ gap: 10 }}>
                        {stats.goalSummaries.map((g) => (
                          <View key={g.id} style={styles.goalRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.goalName} numberOfLines={1}>
                                {g.name}
                              </Text>
                              <Text style={styles.subtle}>{g.label}</Text>
                            </View>
                            <View style={styles.goalPill}>
                              <Text style={styles.goalPillText}>
                                {Math.round(clamp01(g.progress) * 100)}%
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.subtle}>
                        No plan goals found for this plan.
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        </SectionCard>

        {/* Next step should NOT show on active plan */}
        {!isActivePlan && !loading && !!plan && (
          <SectionCard>
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionTitle}>Next step</Text>
              <Text style={styles.subtle}>
                Next we can add: PRs hit during plan, exercise-by-exercise
                progression graphs, and a proper “plan score” plus
                recommendations for your next plan.
              </Text>
            </View>
          </SectionCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 40,
    },

    backBtn: {
      width: 44,
      height: 40,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    backIcon: {
      fontSize: 22,
      fontWeight: "900",
      color: colors.text,
    },

    rightSpacer: {
      width: 44,
      height: 40,
    },

    heading: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      flex: 1,
    },

    startPlanCta: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.primaryBg ?? colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    startPlanCtaText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.text,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    title: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
      flex: 1,
    },

    subtle: {
      color: colors.subtle,
      fontSize: 13,
      lineHeight: 18,
    },

    strong: {
      color: colors.text,
      fontWeight: "900",
    },

    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "900",
    },
    statusPillActive: {
      backgroundColor: "rgba(59,130,246,0.12)",
    },
    statusTextActive: {
      color: colors.primary ?? "#3b82f6",
    },
    statusPillDone: {
      backgroundColor: colors.successBg ?? "rgba(34,197,94,0.12)",
    },
    statusTextDone: {
      color: colors.successText ?? "#16a34a",
    },

    kpiGrid: {
      flexDirection: "row",
      gap: 10,
    },
    kpiCard: {
      flex: 1,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
      padding: 10,
      gap: 6,
    },
    kpiLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.subtle,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },
    kpiLine: {
      fontSize: 13,
      color: colors.subtle,
    },
    kpiStrong: {
      color: colors.text,
      fontWeight: "900",
    },

    sectionBox: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
      padding: 12,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.text,
    },

    improvedRow: {
      flexDirection: "row",
      gap: 10,
    },
    improvedCard: {
      flex: 1,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
      padding: 10,
      gap: 6,
    },
    improvedLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.subtle,
    },
    improvedValue: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },

    goalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    goalName: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },
    goalPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primaryBg ?? "rgba(59,130,246,0.10)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    goalPillText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.text,
    },

    infoBox: {
      marginTop: 2,
      padding: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
      gap: 6,
    },
    infoTitle: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.text,
    },

    workoutBlock: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
      padding: 10,
      gap: 10,
    },
    workoutTitle: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.text,
    },
    exerciseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    exerciseName: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },

    ctaWrap: { alignItems: "center" },

    startPlanCtaBig: {
      width: "100%",
      maxWidth: 360,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryBg ?? colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    startPlanCtaBigText: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
    },

    improvedStack: { gap: 10 },
    improvedRowCard: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
      padding: 12,
      gap: 6,
    },
  });
