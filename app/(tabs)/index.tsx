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
} from "react-native";
import { useAuth } from "../../lib/useAuth";
import { useAppTheme } from "../../lib/useAppTheme";
import { useDeviceSteps } from "../../lib/hooks/useDeviceSteps";
import { useWeeklyHomeData } from "../../lib/hooks/useWeeklyHomeData";
import { GreetingHeader } from "../../components/cards/GreetingHeader";
import { StatsRings } from "../../components/cards/StatsRings";
import { TopMuscleCardContent } from "../../components/cards/TopMuscleCard";
import { PersonalBestCardContent } from "../../components/cards/PersonalBestCard";
import { GoalProgressCard } from "../../components/cards/GoalProgressCard";
import { NextWorkoutSection } from "../../components/cards/NextWorkoutSection";
import { Sparkline } from "../../components/ui/Sparkline";
import { useRouter } from "expo-router";
import { QUOTES, quoteOfTheDay } from "../../lib/quotes";
import Svg, { Polyline, Line } from "react-native-svg";
import { RingProgress } from "../features/home/RingProgress";
import { Pedometer } from "expo-sensors";
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

  // NEW: use plan goals hook
  const { plan, goals } = usePlanGoals(userId);

  // NEW: ring state
  const [goalsRingProgress, setGoalsRingProgress] = useState(0); // 0–1
  const [goalsRingLabel, setGoalsRingLabel] = useState("0%");
  const [goalsRingLoading, setGoalsRingLoading] = useState(true);

  const ringModeLabel = plan && goals && goals.length > 0 ? "Plan" : "Weekly";

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
        if (plan && goals && goals.length > 0) {
          const exerciseGoals = goals
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
            .gte("completed_at", plan.start_date)
            .lte("completed_at", plan.end_date)
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
  }, [userId, plan?.id, goals]);

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
                    size={45} // larger ring
                    stroke={8}
                    progress={goalsRingProgress}
                    color={ringColor}
                    trackColor={colors.border}
                    label="" // we show text below instead
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
  });
