// lib/useWeeklyHomeData.ts
import * as React from "react";
import { supabase } from "../../lib/supabase";

export type WeeklyBasics = {
  user_id: string;
  workouts_this_week: number;
  weekly_workout_goal: number | null;
  volume_this_week: number;
  volume_last_week: number;
  volume_vs_last_week_ratio: number | null;
};

export type TopMuscleRow = {
  user_id: string;
  muscle_name: string;
  muscle_volume: number;
  pct_of_week: number; // 0..100
};

export type LatestPR = {
  user_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  completed_at: string;
  prev_weight: number | null;
  pct_increase: number | null;
};

export type NextWorkoutRow = { user_id: string; next_workout_title: string };

export type PlanWorkoutUI = {
  id: string;
  workout_id: string;
  title: string | null;
  order_index: number;
  weekly_complete: boolean | null;
  is_archived: boolean | null;
  exercises: string[];
};

type MuscleBreakdownRow = {
  muscle_name: string;
  muscle_volume: number;
  pct_of_week: number;
};

export function useWeeklyHomeData(userId: string | null) {
  const [loading, setLoading] = React.useState(true);
  const [fullName, setFullName] = React.useState("User");
  const [stepsGoalFromProfile, setStepsGoalFromProfile] = React.useState<number | null>(null);

  const [weeklyBasics, setWeeklyBasics] = React.useState<WeeklyBasics | null>(null);

  // Always last 7 days:
  const [muscleBreakdown7d, setMuscleBreakdown7d] = React.useState<MuscleBreakdownRow[]>([]);
  const [topMuscle, setTopMuscle] = React.useState<TopMuscleRow | null>(null);

  const [latestPR, setLatestPR] = React.useState<LatestPR | null>(null);
  const [nextWorkout, setNextWorkout] = React.useState<NextWorkoutRow | null>(null);

  const [hasPlans, setHasPlans] = React.useState(false);
  const [activePlanId, setActivePlanId] = React.useState<string | null>(null);
  const [planWorkouts, setPlanWorkouts] = React.useState<PlanWorkoutUI[]>([]);
  const [steps7, setSteps7] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        // Profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, steps_goal, settings, active_plan_id")
          .eq("id", userId)
          .maybeSingle();
        if (!alive) return;

        if (profile?.name) setFullName(profile.name);
        if (typeof profile?.steps_goal === "number") setStepsGoalFromProfile(profile.steps_goal);
        setActivePlanId(profile?.active_plan_id ?? null);

        const { data: plansList } = await supabase
          .from("plans").select("id").eq("user_id", userId).limit(1);
        if (!alive) return;
        setHasPlans(!!plansList?.length);

        // Views (weekly basics, PR, next workout)
        const [basics, pr, nextW] = await Promise.all([
          supabase.from("v_user_weekly_basics").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("v_user_latest_pr_v2")
                  .select("user_id, exercise_name, weight, reps, completed_at, prev_weight, pct_increase")
                  .eq("user_id", userId).maybeSingle(),
          supabase.from("v_user_next_workout").select("*").eq("user_id", userId).maybeSingle(),
        ]);
        if (!alive) return;

        setWeeklyBasics((basics?.data as WeeklyBasics) ?? null);
        setLatestPR((pr?.data as LatestPR) ?? null);
        setNextWorkout((nextW?.data as NextWorkoutRow) ?? null);

        // MUSCLES — always last 7 days, single source of truth
        const { data: breakdown } = await supabase
          .from("v_user_muscle_breakdown_last7d")
          .select("muscle_name, muscle_volume, pct_of_week")
          .eq("user_id", userId)
          .order("pct_of_week", { ascending: false });

        if (!alive) return;

        const rows = Array.isArray(breakdown) ? breakdown as MuscleBreakdownRow[] : [];
        setMuscleBreakdown7d(rows);

        const top = rows[0];
        if (top) {
          setTopMuscle({
            user_id: userId,
            muscle_name: top.muscle_name,
            muscle_volume: Number(top.muscle_volume) || 0,
            pct_of_week: Number(top.pct_of_week) || 0,
          });
        } else {
          setTopMuscle(null);
        }

        // Plan workouts + exercise names
        if (profile?.active_plan_id) {
          const { data: pwRows } = await supabase
            .from("plan_workouts")
            .select("id, workout_id, title, order_index, weekly_complete, is_archived")
            .eq("plan_id", profile.active_plan_id)
            .order("order_index");
          if (!alive) return;

          const cleanPW = (pwRows ?? []).filter((r: any) => !r.is_archived);
          const workoutIds = Array.from(new Set(cleanPW.map((r: any) => r.workout_id).filter(Boolean)));
          const byWorkout = new Map<string, string[]>();

          if (workoutIds.length) {
            const { data: wex } = await supabase
              .from("workout_exercises")
              .select("workout_id, exercise_id, order_index")
              .in("workout_id", workoutIds)
              .order("order_index");

            if (Array.isArray(wex) && wex.length) {
              const exIds = Array.from(new Set(wex.map((r: any) => r.exercise_id).filter(Boolean)));
              const { data: exRows } = await supabase
                .from("exercises").select("id, name").in("id", exIds);

              const nameById = new Map<string, string>();
              (exRows ?? []).forEach((r: any) => nameById.set(r.id, r.name ?? "Exercise"));

              wex.forEach((row: any) => {
                const arr = byWorkout.get(row.workout_id) ?? [];
                arr.push(nameById.get(row.exercise_id) ?? "Exercise");
                byWorkout.set(row.workout_id, arr);
              });
            }
          }

          setPlanWorkouts(
            cleanPW.map((r: any) => ({
              id: r.id,
              workout_id: r.workout_id,
              title: r.title,
              order_index: r.order_index,
              weekly_complete: r.weekly_complete,
              is_archived: r.is_archived,
              exercises: (byWorkout.get(r.workout_id) ?? []).slice(0, 6),
            }))
          );
        } else {
          setPlanWorkouts([]);
        }

        // Steps (home sparkline)
        {
          const today = new Date();
          const from = new Date(today);
          from.setDate(today.getDate() - 6);

          const { data: ds } = await supabase
            .from("daily_steps")
            .select("day, steps")
            .eq("user_id", userId)
            .gte("day", from.toISOString().slice(0, 10))
            .lte("day", today.toISOString().slice(0, 10))
            .order("day", { ascending: true });
          if (!alive) return;

          const map = new Map<string, number>();
          (ds ?? []).forEach((r: any) => map.set(String(r.day).slice(0, 10), r.steps ?? 0));
          const arr: number[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            arr.push(map.get(key) ?? 0);
          }
          setSteps7(arr);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId]);

  return {
    loading,
    fullName,
    stepsGoalFromProfile,
    weeklyBasics,

    // MUSCLES
    muscleBreakdown7d, // for pie page (full list)
    topMuscle,         // for home card (derived from breakdown)

    latestPR,
    nextWorkout,

    hasPlans,
    activePlanId,
    planWorkouts,

    steps7,
    setStepsGoalFromProfile,
  };
}
