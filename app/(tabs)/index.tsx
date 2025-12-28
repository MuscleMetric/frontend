import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  PermissionsAndroid,
  AppState,
  Modal,
  Image,
} from "react-native";
import { useAuth } from "../../lib/authContext";
import { useAppTheme } from "../../lib/useAppTheme";
import { useDeviceSteps } from "../../lib/hooks/useDeviceSteps";
import { useWeeklyHomeData } from "../../lib/hooks/useWeeklyHomeData";
import { GreetingHeader } from "../../components/cards/GreetingHeader";
import { StatsRings } from "../../components/cards/StatsRings";
import { TopMuscleCardContent } from "../../components/cards/TopMuscleCard";
import { PersonalBestCardContent } from "../../components/cards/PersonalBestCard";
import { NextWorkoutSection } from "../../components/cards/NextWorkoutSection";
import { useRouter } from "expo-router";
import { quoteOfTheDay } from "../../lib/quotes";
import Svg, { Polyline, Line } from "react-native-svg";
import { RingProgress } from "../features/home/RingProgress";
import { BirthdayConfetti } from "../_components/Confetti/BirthdayConfetti";
import { ChristmasConfetti } from "../_components/Confetti/ChristmasConfetti";
import { MiniMonthCalendar } from "../_components/Calendar/MiniMonthCalendar";
const logo = require("../../assets/icon.png");

import {
  registerBackgroundFetch,
  onAppActiveSync,
} from "../features/steps/stepsSync";
import { usePlanGoals } from "../features/goals/hooks/usePlanGoals";
import { supabase } from "../../lib/supabase";

function weekKeySundayLocal(d: Date) {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0 = Sun
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - dow);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDayKeyFromIso(iso: string) {
  const d = new Date(iso); // converts to local time automatically
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseStart(notes?: string | null): number | null {
  if (!notes) return null;
  try {
    const obj = JSON.parse(notes);
    if (typeof obj?.start === "number") return obj.start;
  } catch {}
  return null;
}

function coerceUnitRound(
  value: number,
  type: "exercise_weight" | "exercise_reps" | "distance" | "time"
): number {
  const roundQuarter = (n: number) => Math.round(n * 4) / 4;
  const roundTime = (s: number) => Math.round(s / 5) * 5;
  const roundDistance = (d: number) => Math.round(d * 10) / 10;

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

export default function Home() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Consistency calendar (no-plan + full width card)
  const [trainedKeys, setTrainedKeys] = useState<Set<string>>(new Set());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // month shown in modal (default = current month start)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // workouts list for selected day
  type DayWorkoutRow = {
    id: string;
    completed_at: string;
    duration_seconds: number | null;
    workout_id: string | null;
    workout_title: string;
  };

  const [selectedDayWorkouts, setSelectedDayWorkouts] = useState<
    DayWorkoutRow[]
  >([]);
  const [selectedDayLoading, setSelectedDayLoading] = useState(false);

  function monthStartLocal(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  function addMonths(d: Date, delta: number) {
    return new Date(d.getFullYear(), d.getMonth() + delta, 1);
  }

  const currentMonthStart = monthStartLocal(new Date());
  const canGoNextMonth =
    monthStartLocal(calendarMonth).getTime() < currentMonthStart.getTime();

  // Birthday
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [birthdayAge, setBirthdayAge] = useState<number | null>(null);
  const [birthdayName, setBirthdayName] = useState<string | null>(null);

  // Christmas
  const [christmasOpen, setChristmasOpen] = useState(false);
  const [christmasName, setChristmasName] = useState<string | null>(null);

  // Plan completed
  const [planCompleteEventId, setPlanCompleteEventId] = useState<string | null>(
    null
  );
  const [completedPlanId, setCompletedPlanId] = useState<string | null>(null);
  const [completedPlanTitle, setCompletedPlanTitle] = useState<string | null>(
    null
  );
  const [completedPlanNumber, setCompletedPlanNumber] = useState<number | null>(
    null
  );

  type Celebration = "birthday" | "christmas" | "plan_completed";

  const [celebrationQueue, setCelebrationQueue] = useState<Celebration[]>([]);
  const [activeCelebration, setActiveCelebration] =
    useState<Celebration | null>(null);

  function enqueueCelebration(type: Celebration) {
    setCelebrationQueue((q) => {
      if (q.includes(type)) return q;

      // birthday always comes before christmas
      const next = [...q, type].sort((a, b) => {
        const rank: Record<Celebration, number> = {
          birthday: 0,
          christmas: 1,
          plan_completed: 2,
        };
        return rank[a] - rank[b];
      });

      return next;
    });
  }

  function ordinal(n: number) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  async function loadWorkoutsForDay(dayKey: string) {
    if (!userId) return;

    setSelectedDayLoading(true);
    try {
      // dayKey is local yyyy-mm-dd
      const startLocal = new Date(`${dayKey}T00:00:00`);
      const endLocal = new Date(startLocal);
      endLocal.setDate(endLocal.getDate() + 1);

      const { data, error } = await supabase
        .from("workout_history")
        .select(
          `
        id,
        completed_at,
        duration_seconds,
        workout_id,
        workouts(title)
      `
        )
        .eq("user_id", userId)
        .gte("completed_at", startLocal.toISOString())
        .lt("completed_at", endLocal.toISOString())
        .order("completed_at", { ascending: false });

      if (error) throw error;

      const rows: DayWorkoutRow[] = (data ?? []).map((r: any) => ({
        id: String(r.id),
        completed_at: String(r.completed_at),
        duration_seconds:
          r.duration_seconds != null ? Number(r.duration_seconds) : null,
        workout_id: r.workout_id ? String(r.workout_id) : null,
        workout_title: String(r.workouts?.title ?? "Workout"),
      }));

      setSelectedDayWorkouts(rows);
    } catch (e) {
      console.warn("loadWorkoutsForDay error:", e);
      setSelectedDayWorkouts([]);
    } finally {
      setSelectedDayLoading(false);
    }
  }

  function onPickDay(k: string) {
    setSelectedDayKey(k);
    loadWorkoutsForDay(k);
  }

  useEffect(() => {
    if (!userId) {
      setTrainedKeys(new Set());
      return;
    }

    let cancelled = false;

    async function loadTrainedDays() {
      try {
        // Pull last ~120 days so the modal can scroll back a few months without refetch
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 120);

        const { data, error } = await supabase
          .from("workout_history")
          .select("completed_at")
          .eq("user_id", userId)
          .gte("completed_at", start.toISOString())
          .lte("completed_at", end.toISOString())
          .order("completed_at", { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        const keys = new Set<string>();
        (data ?? []).forEach((r: any) => {
          if (!r?.completed_at) return;
          keys.add(localDayKeyFromIso(String(r.completed_at))); // local day key
        });

        setTrainedKeys(keys);
      } catch (e) {
        console.warn("loadTrainedDays error:", e);
        if (!cancelled) setTrainedKeys(new Set());
      }
    }

    loadTrainedDays();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function checkPlanCompleted() {
      try {
        // 1) find unconsumed plan_completed event
        const { data: evt, error: evtErr } = await supabase
          .from("user_events")
          .select("id, payload, created_at")
          .eq("user_id", userId)
          .eq("type", "plan_completed")
          .is("consumed_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (evtErr) {
          console.warn("plan_completed event fetch error:", evtErr.message);
          return;
        }

        if (!evt?.id) return;

        const planId = (evt.payload as any)?.plan_id as string | undefined;
        if (!planId) return;

        // 2) fetch plan details (title)
        const { data: planRow, error: planErr } = await supabase
          .from("plans")
          .select("id, title, completed_at")
          .eq("id", planId)
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (planErr) {
          console.warn("completed plan fetch error:", planErr.message);
          return;
        }

        // 3) compute nth plan number = count of completed plans (including this one)
        // If you ever allow "abandoned" states later, we’ll adjust.
        const { count: completedCount, error: countErr } = await supabase
          .from("plans")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_completed", true);

        if (cancelled) return;

        if (countErr) {
          console.warn("completed plans count error:", countErr.message);
        }

        setPlanCompleteEventId(evt.id);
        setCompletedPlanId(planId);
        setCompletedPlanTitle(planRow?.title ?? "Your plan");
        setCompletedPlanNumber(completedCount ?? null);

        // 4) queue the celebration modal
        enqueueCelebration("plan_completed");
      } catch (e) {
        console.warn("plan completed check failed:", e);
      }
    }

    checkPlanCompleted();

    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") checkPlanCompleted();
    });

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [userId]);

  async function consumePlanCompleteEvent() {
    if (!planCompleteEventId || !userId) return;
    try {
      await supabase
        .from("user_events")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", planCompleteEventId)
        .eq("user_id", userId);
    } catch (e) {
      console.warn("consume plan_complete event failed:", e);
    } finally {
      setPlanCompleteEventId(null);
    }
  }

  async function onViewPlanHistory() {
    if (!completedPlanId) {
      closeCelebration();
      return;
    }

    // consume first so it doesn't re-open if nav is slow
    await consumePlanCompleteEvent();

    closeCelebration();

    // adjust route to your actual plan history route
    router.push({
      pathname: "/features/plans/history/view",
      params: { planId: completedPlanId },
    });
  }

  async function onDismissPlanComplete() {
    await consumePlanCompleteEvent();
    closeCelebration();
  }

  function startNextCelebration() {
    setCelebrationQueue((q) => {
      if (q.length === 0) {
        setActiveCelebration(null);
        return q;
      }
      const [next, ...rest] = q;
      setActiveCelebration(next);
      return rest;
    });
  }

  function closeCelebration() {
    setActiveCelebration(null);
    // slight tick so the next modal doesn’t fight the fade animation
    setTimeout(() => startNextCelebration(), 200);
  }

  useEffect(() => {
    if (!activeCelebration && celebrationQueue.length > 0) {
      startNextCelebration();
    }
  }, [celebrationQueue, activeCelebration]);

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

  // NEW: use plan goals hook
  const { plan, goals } = usePlanGoals(userId);

  const isActivePlan = !!plan && (plan as any).is_completed === false;
  const activePlan = isActivePlan ? plan : null;
  const activePlanGoals = isActivePlan ? goals : [];

  // NEW: ring state
  const [goalsRingProgress, setGoalsRingProgress] = useState(0); // 0–1
  const [goalsRingLabel, setGoalsRingLabel] = useState("0%");
  const [goalsRingLoading, setGoalsRingLoading] = useState(true);

  const ringModeLabel =
    activePlan && activePlanGoals && activePlanGoals.length > 0
      ? "Plan"
      : "Weekly";

  const ringColor =
    goalsRingProgress < 1 / 3
      ? "#ef4444"
      : goalsRingProgress < 2 / 3
      ? "#eab308"
      : colors.successBg ?? colors.primary;

  const { stepsToday, stepsAvailable, stepsGoal, setStepsGoal } =
    useDeviceSteps(10000);
  // Home screen
  const {
    loading,
    stepsGoalFromProfile,
    weeklyBasics,
    latestPR,
    nextWorkout,
    hasPlans,
    activePlanId,
    planWorkouts,
    steps7,
    topMuscle,
  } = useWeeklyHomeData(userId);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function checkBirthday() {
      try {
        const { data, error } = await supabase.rpc("birthday_check_and_mark");
        if (cancelled) return;
        if (error) {
          console.warn("birthday_check_and_mark error:", error.message);
          return;
        }

        if (data?.shouldShow) {
          setBirthdayAge(typeof data.age === "number" ? data.age : null);
          setBirthdayName(typeof data.name === "string" ? data.name : null);
          enqueueCelebration("birthday");
        }
      } catch (e) {
        console.warn("birthday check failed:", e);
      }
    }

    // Run once on screen mount
    checkBirthday();

    // Optional: also run when app comes to foreground
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkBirthday();
    });

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function checkChristmas() {
      const { data, error } = await supabase.rpc("christmas_check_and_mark");
      if (cancelled) return;

      if (error) {
        console.warn("christmas_check_and_mark:", error.message);
        return;
      }

      if (data?.shouldShow) {
        setChristmasName(typeof data.name === "string" ? data.name : null);
        enqueueCelebration("christmas");
      }
    }

    checkChristmas();

    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") checkChristmas();
    });

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [userId]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const seed = `${session?.user?.id ?? "anon"}|${todayKey}`;
  const dailyQuote = quoteOfTheDay(seed);

  useEffect(() => {
    if (!userId) {
      setGoalsRingProgress(0);
      setGoalsRingLabel("0%");
      setGoalsRingLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setGoalsRingLoading(true);
      try {
        // ---- CASE 1: user has a plan with goals -> average progress over up to 3 exercises ----
        if (activePlan && activePlanGoals && activePlanGoals.length > 0) {
          const exerciseGoals = activePlanGoals
            .filter((g: any) => g.exercises?.id)
            .slice(0, 3);

          if (!exerciseGoals.length) {
            throw new Error("No exercise-based plan goals.");
          }

          const exerciseIds = exerciseGoals.map(
            (g: any) => g.exercises!.id as string
          );

          const goalByExerciseId: Record<string, any> = {};
          exerciseGoals.forEach((g: any) => {
            if (g.exercises?.id) {
              goalByExerciseId[g.exercises.id] = g;
            }
          });

          // get all history for those exercises in the plan date range
          const { data, error } = await supabase
            .from("workout_history")
            .select(
              `
            id,
            completed_at,
            workout_exercise_history!inner(
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
            .gte("completed_at", activePlan.start_date)
            .lte("completed_at", activePlan.end_date)
            .order("completed_at", { ascending: true });

          if (error) throw error;

          // latest actual value per exercise
          const latestByExercise: Record<string, number> = {};

          (data ?? []).forEach((row: any) => {
            const histories = row.workout_exercise_history ?? [];
            histories.forEach((eh: any) => {
              const exId = eh.exercise_id as string;
              if (!exerciseIds.includes(exId)) return;

              const g = goalByExerciseId[exId];
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

              const val = coerceUnitRound(rawVal, g.type);
              latestByExercise[exId] = val; // rows ordered asc, so this ends up as latest
            });
          });

          // compute per-goal progress and average
          const progresses: number[] = [];
          exerciseGoals.forEach((g: any) => {
            const exId = g.exercises!.id as string;
            const target = Number(g.target_number);
            const startParsed = parseStart(g.notes);
            const start = typeof startParsed === "number" ? startParsed : 0;

            const actual =
              latestByExercise[exId] !== undefined
                ? latestByExercise[exId]
                : start;

            if (target <= start) {
              // weird config; treat as done if we're at/above target
              progresses.push(actual >= target ? 1 : 0);
            } else {
              const frac = (actual - start) / (target - start);
              const clamped = Math.max(0, Math.min(1, frac));
              progresses.push(clamped);
            }
          });

          const avg =
            progresses.length > 0
              ? progresses.reduce((a, b) => a + b, 0) / progresses.length
              : 0;

          if (!cancelled) {
            setGoalsRingProgress(avg);
            setGoalsRingLabel(`${Math.round(avg * 100)}%`);
          }
          return;
        }

        // ---- CASE 2: no plan/goals -> weekly workouts vs goal ----
        const now = new Date();
        const wk = weekKeySundayLocal(now);

        const { data: weekly, error: weeklyErr } = await supabase
          .from("user_weekly_workout_stats")
          .select("goal, completed")
          .eq("user_id", userId)
          .eq("week_key", wk)
          .maybeSingle();

        if (weeklyErr) throw weeklyErr;

        let goalNum = Number(weekly?.goal ?? 0);
        let completedNum = Number(weekly?.completed ?? 0);

        // fallback to profile weekly_workout_goal if no row yet
        if (!weekly) {
          const { data: prof, error: profErr } = await supabase
            .from("profiles")
            .select("weekly_workout_goal")
            .eq("id", userId)
            .maybeSingle();
          if (profErr) throw profErr;
          goalNum =
            prof?.weekly_workout_goal != null
              ? Number(prof.weekly_workout_goal)
              : 3;
          completedNum = 0;
        }

        const frac =
          goalNum > 0 ? Math.max(0, Math.min(1, completedNum / goalNum)) : 0;

        if (!cancelled) {
          setGoalsRingProgress(frac);
          setGoalsRingLabel(`${completedNum}/${goalNum || "?"}`);
        }
      } catch (e) {
        console.warn("Goals ring load error:", e);
        if (!cancelled) {
          setGoalsRingProgress(0);
          setGoalsRingLabel("0%");
        }
      } finally {
        if (!cancelled) setGoalsRingLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, (activePlan as any)?.id, goals]);

  useEffect(() => {
    let sub: any;

    (async () => {
      // (Optional) Ask activity permission on Android
      if (Platform.OS === "android") {
        await PermissionsAndroid.request(
          "android.permission.ACTIVITY_RECOGNITION"
        );
      }
      await registerBackgroundFetch();
      await onAppActiveSync(); // ← run once on mount
    })();

    sub = AppState.addEventListener("change", (state) => {
      if (state === "active") onAppActiveSync(); // ← run again when app comes to foreground
    });

    return () => {
      sub?.remove?.();
    };
  }, []);

  // prefer DB goal if present
  React.useEffect(() => {
    if (typeof stepsGoalFromProfile === "number")
      setStepsGoal(stepsGoalFromProfile);
  }, [stepsGoalFromProfile]);

  const stepsPct = stepsGoal > 0 ? stepsToday / stepsGoal : 0;
  const workoutsPct =
    (weeklyBasics?.weekly_workout_goal ?? 3) > 0
      ? (weeklyBasics?.workouts_this_week ?? 0) /
        (weeklyBasics?.weekly_workout_goal ?? 3)
      : 0;
  const volumePct =
    (weeklyBasics?.volume_last_week ?? 0) > 0
      ? (weeklyBasics?.volume_this_week ?? 0) /
        (weeklyBasics?.volume_last_week ?? 0)
      : (weeklyBasics?.volume_this_week ?? 0) > 0
      ? 1
      : 0;

  const goalPct = Math.max(0, Math.min(1, workoutsPct));
  const goalPctLabel = `You're ${Math.round(
    goalPct * 100
  )}% toward your weekly goal`;

  const nextIncompletePW = React.useMemo(() => {
    if (!planWorkouts?.length) return null;
    const notArchived = planWorkouts.filter((p) => !p.is_archived);
    const next = notArchived.find((p) => !p.weekly_complete);
    return next ?? null;
  }, [planWorkouts]);

  const nextTitle =
    nextWorkout?.next_workout_title ??
    (nextIncompletePW?.title || "Next workout");

  function StepsSparklineWithLabels({
    data,
    labels,
    height = 70,
    padding = 8,
    lineColor = "#93c5fd",
    tickColor = "#E5E7EB",
    labelColor = "#9CA3AF",
  }: {
    data: number[];
    labels: string[]; // should be same length as data
    height?: number;
    padding?: number; // MUST match the labels’ side padding
    lineColor?: string;
    tickColor?: string;
    labelColor?: string;
  }) {
    const [width, setWidth] = React.useState(0);
    const n = data.length;
    const innerW = Math.max(0, width - padding * 2);

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const span = Math.max(1, max - min);

    // x-positions used by BOTH the polyline and the label row
    const xs = React.useMemo(
      () => data.map((_, i) => padding + (i * innerW) / Math.max(1, n - 1)),
      [data, innerW, padding, n]
    );

    const points = React.useMemo(
      () =>
        data
          .map((v, i) => {
            const x = xs[i];
            const y =
              height - padding - ((v - min) / span) * (height - padding * 2);
            return `${x},${y}`;
          })
          .join(" "),
      [data, xs, height, padding, min, span]
    );

    return (
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {/* Chart */}
        <Svg width={width} height={height}>
          {/* tiny ticks at the bottom aligned with each label/day */}
          {xs.map((x, i) => (
            <Line
              key={`tick-${i}`}
              x1={x}
              x2={x}
              y1={height - padding}
              y2={height - padding + 5}
              stroke={tickColor}
              strokeWidth={1}
            />
          ))}
          <Polyline
            points={points}
            fill="none"
            stroke={lineColor}
            strokeWidth={3}
          />
        </Svg>

        {/* Labels row: same width + same padding = perfect alignment */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: padding, // ← MUST equal `padding` above
            marginTop: 8,
          }}
        >
          {labels.map((d, i) => (
            <Text key={i} style={{ color: labelColor, opacity: 0.8 }}>
              {d}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  function CardPressable({
    onPress,
    children,
    style,
    disabled,
  }: {
    onPress: () => void;
    children: React.ReactNode;
    style: any;
    disabled?: boolean;
  }) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        android_ripple={{ color: "#00000010" }}
        style={({ pressed }) => [
          style,
          pressed && !disabled
            ? { opacity: 0.98, transform: [{ scale: 0.997 }] }
            : null,
        ]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {children}
      </Pressable>
    );
  }

  const hasActivePlan = !plan?.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <GreetingHeader title={dailyQuote} colors={colors} />
        {/* Rings */}
        <StatsRings
          colors={colors}
          steps={stepsToday}
          stepsGoal={stepsGoal}
          workouts={weeklyBasics?.workouts_this_week ?? 0}
          workoutGoal={weeklyBasics?.weekly_workout_goal ?? 3}
          volume={weeklyBasics?.volume_this_week ?? 0}
          volumeLastWeek={weeklyBasics?.volume_last_week ?? 0}
        />

        <View style={styles.gridRow}>
          <CardPressable
            disabled={loading}
            onPress={() => router.push("/features/home/muscle")}
            style={styles.gridCard}
          >
            <TopMuscleCardContent
              colors={colors}
              loading={loading}
              data={
                topMuscle && {
                  muscle_name: topMuscle.muscle_name,
                  pct_of_week: Number(topMuscle.pct_of_week),
                }
              }
            />
          </CardPressable>

          <CardPressable
            disabled={loading}
            onPress={() => router.push("/features/home/prs")}
            style={styles.gridCard}
          >
            <PersonalBestCardContent
              colors={colors}
              loading={loading}
              pr={latestPR}
            />
          </CardPressable>
        </View>

        <View style={styles.gridRow}>
          <CardPressable
            disabled={loading}
            onPress={() =>
              router.push({
                pathname: "/features/home/stepHistory",
                params: {
                  steps7: JSON.stringify(steps7),
                  stepsGoal: String(stepsGoal),
                },
              })
            }
            style={styles.gridCard}
          >
            <Text style={styles.title}>STEPS - LAST 7 DAYS</Text>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <StepsSparklineWithLabels
                data={steps7}
                labels={last7DayInitials()} // same length as data
                height={70}
                padding={8} // keep this in sync
                lineColor={colors.primaryText}
                tickColor={colors.border}
                labelColor={colors.subtle}
              />
            )}
          </CardPressable>

          <CardPressable
            disabled={goalsRingLoading}
            onPress={() => router.push("/features/goals/goals")}
            style={styles.gridCard}
          >
            <View style={styles.goalProgressCenter}>
              <Text style={styles.title}>GOAL PROGRESS</Text>

              {goalsRingLoading ? (
                <ActivityIndicator style={{ marginTop: 12 }} />
              ) : (
                <>
                  <RingProgress
                    size={45}
                    stroke={8}
                    progress={goalsRingProgress}
                    color={ringColor}
                    trackColor={colors.border}
                    label=""
                  />

                  <Text style={[styles.bigCenteredText, { color: ringColor }]}>
                    {goalsRingLabel}
                  </Text>

                  <Text style={styles.centeredModeText}>{ringModeLabel}</Text>
                </>
              )}
            </View>
          </CardPressable>
        </View>

        {/* Full-width consistency card */}
        {!hasActivePlan && (
          <View style={[styles.gridCard, { width: "100%" }]}>
            <Text style={styles.title}>CONSISTENCY</Text>

            <MiniMonthCalendar
              colors={colors}
              trainedKeys={trainedKeys} // Set<string> is OK now
              monthDate={calendarMonth} // show current modal month in the big card too (optional)
              onPressHeader={() => setCalendarOpen(true)}
              onPressDay={onPickDay}
              selectedDayKey={selectedDayKey}
              compact={false}
            />

            {/* Space below calendar = selected day list */}
            <View style={{ marginTop: 12, gap: 8 }}>
              {!selectedDayKey ? (
                <Text style={{ color: colors.subtle, fontWeight: "700" }}>
                  Tap a day to see workouts.
                </Text>
              ) : selectedDayLoading ? (
                <ActivityIndicator />
              ) : selectedDayWorkouts.length === 0 ? (
                <Text style={{ color: colors.subtle, fontWeight: "700" }}>
                  No workouts on {selectedDayKey}.
                </Text>
              ) : (
                selectedDayWorkouts.slice(0, 4).map((w) => (
                  <Pressable
                    key={w.id}
                    onPress={() => {
                      // open the workout session if you want
                      // router.push({ pathname: "/features/workouts/history/view", params: { sessionId: w.id } })
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      backgroundColor: colors.surface ?? colors.card,
                    }}
                  >
                    <Text
                      style={{ color: colors.text, fontWeight: "900" }}
                      numberOfLines={1}
                    >
                      {w.workout_title}
                    </Text>
                    <Text
                      style={{ color: colors.subtle, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {formatLongDate(w.completed_at)}{" "}
                      {w.duration_seconds
                        ? `· ${Math.round(w.duration_seconds / 60)}m`
                        : ""}
                    </Text>
                  </Pressable>
                ))
              )}

              {selectedDayWorkouts.length > 4 && (
                <Pressable
                  onPress={() => setCalendarOpen(true)}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "900" }}>
                    View all →
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Next workout */}
        <NextWorkoutSection
          colors={colors}
          loading={loading}
          hasPlans={hasPlans}
          activePlanId={activePlanId}
          nextWorkoutTitle={nextTitle}
          nextIncompletePW={nextIncompletePW}
          onCreatePlan={() => router.push("/features/plans/create/planInfo")}
          onOpenWorkout={(workoutId, planWorkoutId) =>
            router.push({
              pathname: "/features/workouts/view",
              params: { workoutId, planWorkoutId },
            })
          }
        />

        <Modal
          visible={activeCelebration === "birthday"}
          transparent
          animationType="fade"
          onRequestClose={() => setBirthdayOpen(false)}
        >
          <Pressable
            onPress={() => setBirthdayOpen(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.38)",
              justifyContent: "center",
              alignItems: "center",
              padding: 18,
            }}
          >
            {/* Confetti behind the card */}
            <BirthdayConfetti active={activeCelebration === "birthday"} />

            {/* Card */}
            <Pressable
              onPress={() => {}}
              style={{
                width: "100%",
                maxWidth: 460,
                backgroundColor: colors.card,
                borderRadius: 22,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                padding: 20,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 10,
              }}
            >
              <View style={{ alignItems: "center", gap: 16 }}>
                {/* To line */}
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  To {birthdayName || "you"},
                </Text>

                {/* Title */}
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "900",
                    color: colors.text,
                    textAlign: "center",
                  }}
                >
                  Happy Birthday 🎉
                </Text>

                {/* Body */}
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    lineHeight: 24,
                    textAlign: "center",
                  }}
                >
                  We hope you have the best day and year. We wish you all the
                  best.
                </Text>

                {/* Age line */}
                {birthdayAge !== null && (
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      textAlign: "center",
                    }}
                  >
                    Hope {birthdayAge} is your strongest year yet.
                  </Text>
                )}

                {/* Sign-off */}
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      textAlign: "center",
                    }}
                  >
                    Best Wishes,
                  </Text>

                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      textAlign: "center",
                    }}
                  >
                    The Muscle Metrics Team
                  </Text>

                  {/* Logo under signature */}
                  <Image
                    source={logo}
                    style={{
                      width: 46,
                      height: 46,
                      marginTop: 6,
                      opacity: 0.95,
                    }}
                    resizeMode="contain"
                  />
                </View>

                {/* CTA */}
                <Pressable
                  onPress={closeCelebration}
                  style={{
                    alignSelf: "stretch",
                    marginTop: 8,
                    paddingVertical: 13,
                    borderRadius: 14,
                    alignItems: "center",
                    backgroundColor: "rgba(59,130,246,0.12)",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: "rgba(59,130,246,0.25)",
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    Let’s go
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={activeCelebration === "christmas"}
          transparent
          animationType="fade"
          onRequestClose={() => setChristmasOpen(false)}
        >
          <Pressable
            onPress={() => setChristmasOpen(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.38)",
              justifyContent: "center",
              alignItems: "center",
              padding: 18,
            }}
          >
            <ChristmasConfetti active={activeCelebration === "christmas"} />

            <Pressable
              onPress={() => {}}
              style={{
                width: "100%",
                maxWidth: 460,
                backgroundColor: colors.card,
                borderRadius: 22,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                padding: 20,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 10,
              }}
            >
              <View style={{ alignItems: "center", gap: 16 }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  To {christmasName || "you"},
                </Text>

                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "900",
                    color: colors.text,
                    textAlign: "center",
                  }}
                >
                  Merry Christmas 🎄
                </Text>

                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    lineHeight: 24,
                    textAlign: "center",
                  }}
                >
                  Wishing you a peaceful day, great food, and a strong finish to
                  the year.
                </Text>

                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Best Wishes,
                </Text>

                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  The Muscle Metrics Team
                </Text>

                <Image
                  source={logo}
                  style={{ width: 46, height: 46, marginTop: 6 }}
                  resizeMode="contain"
                />

                <Pressable
                  onPress={closeCelebration}
                  style={{
                    alignSelf: "stretch",
                    marginTop: 8,
                    paddingVertical: 13,
                    borderRadius: 14,
                    alignItems: "center",
                    backgroundColor: "rgba(34,197,94,0.12)", // festive green tint
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: "rgba(34,197,94,0.25)",
                  }}
                >
                  <Text
                    style={{
                      color: "#16a34a",
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    Let’s go
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={activeCelebration === "plan_completed"}
          transparent
          animationType="fade"
          onRequestClose={onDismissPlanComplete}
        >
          <Pressable
            onPress={onDismissPlanComplete}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.38)",
              justifyContent: "center",
              alignItems: "center",
              padding: 18,
            }}
          >
            {/* You can reuse confetti or make a new one later */}
            <BirthdayConfetti active={activeCelebration === "plan_completed"} />

            <Pressable
              onPress={() => {}}
              style={{
                width: "100%",
                maxWidth: 460,
                backgroundColor: colors.card,
                borderRadius: 22,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                padding: 20,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 10,
              }}
            >
              <View style={{ alignItems: "center", gap: 16 }}>
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Achievement unlocked
                </Text>

                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: "900",
                    color: colors.text,
                    textAlign: "center",
                  }}
                >
                  Well done 💪
                </Text>

                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    lineHeight: 24,
                    textAlign: "center",
                  }}
                >
                  You’ve completed{" "}
                  <Text style={{ fontWeight: "900" }}>
                    {completedPlanNumber
                      ? `your ${ordinal(completedPlanNumber)} plan`
                      : "a plan"}
                  </Text>{" "}
                  on Muscle Metrics.
                </Text>

                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "700",
                    lineHeight: 22,
                    textAlign: "center",
                  }}
                >
                  Tap below to see your accomplishments while completing{" "}
                  <Text style={{ fontWeight: "900", color: colors.text }}>
                    {completedPlanTitle ?? "your plan"}
                  </Text>
                  .
                </Text>

                {/* Signature */}
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontWeight: "800",
                      textAlign: "center",
                    }}
                  >
                    Thank you,
                  </Text>

                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      textAlign: "center",
                    }}
                  >
                    The Muscle Metrics Team
                  </Text>

                  <Image
                    source={logo}
                    style={{
                      width: 46,
                      height: 46,
                      marginTop: 6,
                      opacity: 0.95,
                    }}
                    resizeMode="contain"
                  />
                </View>

                {/* CTA */}
                <Pressable
                  onPress={onViewPlanHistory}
                  style={{
                    alignSelf: "stretch",
                    marginTop: 8,
                    paddingVertical: 13,
                    borderRadius: 14,
                    alignItems: "center",
                    backgroundColor: "rgba(59,130,246,0.12)",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: "rgba(59,130,246,0.25)",
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    View plan summary
                  </Text>
                </Pressable>

                {/* Secondary */}
                <Pressable
                  onPress={onDismissPlanComplete}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "800" }}>
                    Not now
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={calendarOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCalendarOpen(false)}
        >
          <Pressable
            onPress={() => setCalendarOpen(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.38)",
              justifyContent: "center",
              alignItems: "center",
              padding: 18,
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                width: "100%",
                maxWidth: 520,
                backgroundColor: colors.card,
                borderRadius: 22,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                padding: 16,
              }}
            >
              {/* Month controls */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <Pressable
                  onPress={() => setCalendarMonth((m) => addMonths(m, -1))}
                  hitSlop={10}
                  style={{ padding: 8 }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 18,
                    }}
                  >
                    ←
                  </Text>
                </Pressable>

                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 18,
                  }}
                >
                  {calendarMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>

                <Pressable
                  disabled={!canGoNextMonth}
                  onPress={() =>
                    canGoNextMonth && setCalendarMonth((m) => addMonths(m, 1))
                  }
                  hitSlop={10}
                  style={{ padding: 8, opacity: canGoNextMonth ? 1 : 0.35 }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 18,
                    }}
                  >
                    →
                  </Text>
                </Pressable>
              </View>

              <MiniMonthCalendar
                colors={colors}
                trainedKeys={trainedKeys}
                monthDate={calendarMonth}
                onPressDay={(k) => onPickDay(k)}
                selectedDayKey={selectedDayKey}
                compact={false}
              />

              {/* Selected day list inside modal too (optional but nice) */}
              <View style={{ marginTop: 14, gap: 8 }}>
                {!selectedDayKey ? null : selectedDayLoading ? (
                  <ActivityIndicator />
                ) : selectedDayWorkouts.length === 0 ? (
                  <Text style={{ color: colors.subtle, fontWeight: "700" }}>
                    No workouts on {selectedDayKey}.
                  </Text>
                ) : (
                  selectedDayWorkouts.map((w) => (
                    <View
                      key={w.id}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                        backgroundColor: colors.surface ?? colors.card,
                      }}
                    >
                      <Text
                        style={{ color: colors.text, fontWeight: "900" }}
                        numberOfLines={1}
                      >
                        {w.workout_title}
                      </Text>
                      <Text
                        style={{ color: colors.subtle, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {formatLongDate(w.completed_at)}{" "}
                        {w.duration_seconds
                          ? `· ${Math.round(w.duration_seconds / 60)}m`
                          : ""}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <Pressable
                onPress={() => setCalendarOpen(false)}
                style={{
                  marginTop: 14,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: "center",
                  backgroundColor: "rgba(59,130,246,0.12)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: "rgba(59,130,246,0.25)",
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: "900" }}>
                  Done
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function last7DayInitials(): string[] {
  const labels: string[] = [];
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const short = fmt.format(d);
    labels.push(short[0].toUpperCase());
  }
  return labels;
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    gridRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    gridCard: {
      width: "48%",
      minWidth: 0,
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: {
      color: colors.subtle,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 10,
      textTransform: "uppercase",
    },
    weekLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      marginTop: 8,
    },
    bigText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800" as const,
      textAlign: "center",
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.subtle,
    },
    ringModeLabel: {
      marginTop: 2,
      fontSize: 11,
      color: colors.subtle,
      textAlign: "center",
    },
    goalCardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    goalProgressCenter: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },

    bigCenteredText: {
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
      marginTop: 6,
    },

    centeredModeText: {
      fontSize: 13,
      fontWeight: "500",
      color: "#9CA3AF", // gray-400-ish, replace with theme if needed
      textAlign: "center",
    },

    fullWidthCard: {
      width: "100%",
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    fullWidthHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    fullWidthHint: {
      color: colors.subtle,
      fontSize: 12,
      fontWeight: "700",
    },
  });
