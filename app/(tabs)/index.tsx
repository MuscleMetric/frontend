// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  SafeAreaView,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { useAppTheme } from "../../lib/useAppTheme";
import { Pedometer } from "expo-sensors";
import { PermissionsAndroid, AppState } from "react-native";
import {
  registerBackgroundFetch,
  onAppActiveSync,
} from "../features/steps/stepsSync";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";

/** ---------------- Types ---------------- */
type WeeklyBasics = {
  user_id: string;
  workouts_this_week: number;
  weekly_workout_goal: number | null;
  volume_this_week: number;
  volume_last_week: number;
  volume_vs_last_week_ratio: number | null;
};

type TopMuscleRow = {
  user_id: string;
  muscle_name: string;
  muscle_volume: number;
  pct_of_week: number; // 0..100
  cardio_sessions_this_week: number;
};

type LatestPR = {
  user_id: string;
  exercise_name: string;
  weight: number; // kg
  reps: number;
  completed_at: string;
};

type NextWorkoutRow = {
  user_id: string;
  next_workout_title: string;
};

type PlanWorkoutUI = {
  id: string;
  workout_id: string;
  title: string | null;
  order_index: number;
  weekly_complete: boolean | null;
  is_archived: boolean | null;
  exercises: string[];
};

/** ---------------- Component ---------------- */
export default function Home() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);

  // name + greeting
  const [fullName, setFullName] = useState<string>("User");

  // steps (device)
  const [stepsToday, setStepsToday] = useState<number>(0);
  const [stepsAvailable, setStepsAvailable] = useState<boolean>(true);
  const [stepsGoal, setStepsGoal] = useState<number>(10000);

  // new view-driven data
  const [weeklyBasics, setWeeklyBasics] = useState<WeeklyBasics | null>(null);
  const [topMuscle, setTopMuscle] = useState<TopMuscleRow | null>(null);
  const [latestPR, setLatestPR] = useState<LatestPR | null>(null);
  const [nextWorkout, setNextWorkout] = useState<NextWorkoutRow | null>(null);

  // 7-day steps sparkline data
  const [steps7, setSteps7] = useState<number[]>([]);

  const router = useRouter();

  const [hasPlans, setHasPlans] = useState<boolean>(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkoutUI[]>([]);

  // Helpers
  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  useEffect(() => {
    if (!userId) return;
    registerBackgroundFetch();
    onAppActiveSync();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") onAppActiveSync();
    });
    return () => sub.remove();
  }, [userId]);

  // Load today's steps from device
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;

    async function askAndroidPermissionIfNeeded() {
      if (Platform.OS !== "android") return true;
      try {
        const status = await PermissionsAndroid.request(
          "android.permission.ACTIVITY_RECOGNITION"
        );
        return status === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }

    async function loadTodayStepsOnce() {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!available) {
          if (alive) setStepsAvailable(false);
          return;
        }
        if (Platform.OS === "android") {
          const ok = await askAndroidPermissionIfNeeded();
          if (!ok) {
            if (alive) setStepsAvailable(false);
            return;
          }
        }
        const start = startOfToday();
        const end = new Date();
        const count = await Pedometer.getStepCountAsync(start, end);
        if (alive) {
          setStepsAvailable(true);
          setStepsToday(count?.steps ?? 0);
        }
      } catch {
        if (alive) setStepsAvailable(false);
      }
    }

    loadTodayStepsOnce();
    sub = Pedometer.watchStepCount(async () => {
      await loadTodayStepsOnce();
    });
    const interval = setInterval(loadTodayStepsOnce, 60_000);

    return () => {
      alive = false;
      if (sub) sub.remove();
      clearInterval(interval);
    };
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = useMemo(() => {
    const src =
      (session?.user?.user_metadata as any)?.name ??
      fullName ??
      session?.user?.email ??
      "there";
    if (!src) return "there";
    return String(src).split(" ")[0] || "there";
  }, [session?.user?.user_metadata, fullName, session?.user?.email]);

  // Main load
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        setLoading(true);

        // Profile: name + steps goal
        {
          const { data: profile, error: profErr } = await supabase
            .from("profiles")
            .select("name, steps_goal, settings, active_plan_id")
            .eq("id", userId)
            .maybeSingle();

          if (!profErr && profile) {
            if (profile.name) setFullName(profile.name);

            // steps goal (unchanged)
            const fromColumn =
              typeof profile.steps_goal === "number"
                ? profile.steps_goal
                : null;
            const fromSettings = (() => {
              try {
                const sg = (profile as any)?.settings?.steps_goal;
                return typeof sg === "number" ? sg : Number(sg);
              } catch {
                return null;
              }
            })();
            const goal = Number.isFinite(fromColumn)
              ? fromColumn!
              : Number.isFinite(fromSettings!)
              ? Number(fromSettings)
              : 10000;
            setStepsGoal(Math.max(0, Math.min(50000, Math.round(goal))));

            // NEW: active plan id
            setActivePlanId(profile.active_plan_id ?? null);
          }

          // NEW: does the user have any plans at all?
          const { data: plansList } = await supabase
            .from("plans")
            .select("id")
            .eq("user_id", userId)
            .limit(1);

          setHasPlans(!!plansList && plansList.length > 0);
        }

        // Views: basics, top muscle, PR, next workout
        const [basics, muscle, pr, nextW] = await Promise.all([
          supabase
            .from("v_user_weekly_basics")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("v_user_top_muscle_this_week")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("v_user_latest_pr")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("v_user_next_workout")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        if (activePlanId) {
          // 1) Read plan_workouts for the active plan
          const { data: pwRows } = await supabase
            .from("plan_workouts")
            .select(
              "id, workout_id, title, order_index, weekly_complete, is_archived"
            )
            .eq("plan_id", activePlanId)
            .order("order_index", { ascending: true });

          const cleanPW = (pwRows ?? []).filter((r: any) => !r.is_archived);

          // 2) Get exercises for those workout_ids (first 6 names each)
          const workoutIds = Array.from(
            new Set(cleanPW.map((r: any) => r.workout_id).filter(Boolean))
          );
          let byWorkout = new Map<string, string[]>();

          if (workoutIds.length) {
            // 1) Raw workout_exercises rows (no nested select)
            const { data: wex, error: wexErr } = await supabase
              .from("workout_exercises")
              .select("workout_id, exercise_id, order_index")
              .in("workout_id", workoutIds)
              .order("order_index", { ascending: true });

            if (wexErr) {
              console.log("WEX fetch error", wexErr);
            } else if (Array.isArray(wex) && wex.length) {
              // 2) Fetch exercise names explicitly
              const exIds = Array.from(
                new Set(wex.map((r: any) => r.exercise_id).filter(Boolean))
              );

              let nameById = new Map<string, string>();
              if (exIds.length) {
                const { data: exRows, error: exErr } = await supabase
                  .from("exercises")
                  .select("id, name")
                  .in("id", exIds);

                if (exErr) {
                  console.log("Exercises fetch error", exErr);
                } else {
                  (exRows ?? []).forEach((r: any) => {
                    nameById.set(r.id, r.name ?? "Exercise");
                  });
                }
              }

              // 3) Build workout_id -> [exercise names]
              wex.forEach((row: any) => {
                const arr = byWorkout.get(row.workout_id) ?? [];
                const nm = nameById.get(row.exercise_id) ?? "Exercise";
                arr.push(nm);
                byWorkout.set(row.workout_id, arr);
              });
            } else {
              console.log("WEX empty for workouts", workoutIds);
            }
          }

          const enriched: PlanWorkoutUI[] = cleanPW.map((r: any) => ({
            id: r.id,
            workout_id: r.workout_id,
            title: r.title,
            order_index: r.order_index,
            weekly_complete: r.weekly_complete,
            is_archived: r.is_archived,
            exercises: (byWorkout.get(r.workout_id) ?? []).slice(0, 6),
          }));

          setPlanWorkouts(enriched);
        } else {
          setPlanWorkouts([]);
        }

        setWeeklyBasics((basics?.data as WeeklyBasics) ?? null);
        setTopMuscle((muscle?.data as TopMuscleRow) ?? null);
        setLatestPR((pr?.data as LatestPR) ?? null);
        setNextWorkout((nextW?.data as NextWorkoutRow) ?? null);

        // Last 7 days steps for sparkline (from daily_steps table)
        {
          const today = new Date();
          const from = new Date(today);
          from.setDate(today.getDate() - 6); // 7 days window

          const { data: ds } = await supabase
            .from("daily_steps")
            .select("day, steps")
            .eq("user_id", userId)
            .gte("day", from.toISOString().slice(0, 10))
            .lte("day", today.toISOString().slice(0, 10))
            .order("day", { ascending: true });

          if (Array.isArray(ds)) {
            // Build a 7-element array in case of missing days
            const map = new Map<string, number>();
            ds.forEach((r: any) =>
              map.set(String(r.day).slice(0, 10), r.steps ?? 0)
            );
            const arr: number[] = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date(today);
              d.setDate(today.getDate() - i);
              const key = d.toISOString().slice(0, 10);
              arr.push(map.get(key) ?? 0);
            }
            setSteps7(arr);
          } else setSteps7([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Pick the next incomplete workout (fallback to first non-archived if all done)
  const nextIncompletePW = React.useMemo(() => {
    if (!planWorkouts?.length) return null;
    const notArchived = planWorkouts.filter((pw) => !pw.is_archived);
    const next = notArchived.find((pw) => !pw.weekly_complete);
    return next ?? notArchived[0] ?? null;
  }, [planWorkouts]);

  // Computed ring percentages
  const stepsPct = useMemo(
    () => (stepsGoal > 0 ? stepsToday / stepsGoal : 0),
    [stepsToday, stepsGoal]
  );

  const workoutsPct = useMemo(() => {
    const w = weeklyBasics?.workouts_this_week ?? 0;
    const g = weeklyBasics?.weekly_workout_goal ?? 3;
    return g > 0 ? w / g : 0;
  }, [weeklyBasics]);

  const volumePct = useMemo(() => {
    const vThis = weeklyBasics?.volume_this_week ?? 0;
    const vLast = weeklyBasics?.volume_last_week ?? 0;
    if (vLast <= 0) return vThis > 0 ? 1 : 0;
    return vThis / vLast;
  }, [weeklyBasics]);

  const goalPct = Math.max(0, Math.min(1, workoutsPct));
  const goalPctLabel = `You're ${Math.round(
    goalPct * 100
  )}% toward your weekly goal`;

  const greetingName = useMemo(() => {
    return `${greeting}, ${firstName} 👋`;
  }, [greeting, firstName]);

  const nextTitle =
    nextWorkout?.next_workout_title ??
    (nextIncompletePW?.title || "Next workout");

  const canOpenNext = !!activePlanId && !!nextIncompletePW?.workout_id;

  const openNext = () => {
    if (!canOpenNext) return;
    router.push({
      pathname: "/features/workouts/view",
      params: {
        workoutId: String(nextIncompletePW!.workout_id),
        planWorkoutId: String(nextIncompletePW!.id),
      },
    });
  };

  // choose container: Pressable when we can open, else View
  const NextContainer: any = canOpenNext ? Pressable : View;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        {/* Header / Greeting */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{greetingName}</Text>
        </View>

        {/* Top Rings (Steps / Workouts / Volume) */}
        <View style={styles.ringsCard}>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <View style={styles.ringsRow}>
              {/* Steps */}
              <View style={styles.ringCol}>
                <RingCard
                  label="STEPS"
                  value={`${formatNumber(stepsToday)}\n of ${formatNumber(
                    stepsGoal
                  )}`}
                  percent={stepsPct}
                  colors={colors}
                  trackColor={colors.primaryBg}
                  progressColor={colors.primary}
                  textColor={colors.text}
                />
              </View>

              {/* Workouts */}
              <View style={styles.ringCol}>
                <RingCard
                  label="WORKOUTS"
                  value={String(weeklyBasics?.workouts_this_week ?? 0)}
                  subValue={`Goal ${weeklyBasics?.weekly_workout_goal ?? 3}`}
                  percent={workoutsPct}
                  colors={colors}
                  trackColor={colors.successBg}
                  progressColor={colors.successText}
                  textColor={colors.text}
                />
              </View>

              {/* Volume */}
              <View style={styles.ringCol}>
                <RingCard
                  label="VOLUME"
                  value={`${formatNumber(
                    weeklyBasics?.volume_this_week ?? 0
                  )}\nkg`}
                  subValue={
                    (weeklyBasics?.volume_last_week ?? 0) > 0
                      ? `vs ${formatNumber(
                          weeklyBasics?.volume_last_week ?? 0
                        )}`
                      : "vs last week"
                  }
                  percent={volumePct}
                  colors={colors}
                  trackColor={colors.warnBg}
                  progressColor={colors.warnText}
                  textColor={colors.text}
                />
              </View>
            </View>
          )}
        </View>

        {/* Grid: Top Muscle / Personal Best */}
        {/* Grid Row 1: Top Muscle / Personal Best */}
        <View style={styles.gridRow}>
          <View style={[styles.gridCard, styles.gridCardEqual]}>
            <Text style={styles.cardTitle}>TOP MUSCLE GROUP THIS WEEK</Text>
            {loading ? (
              <ActivityIndicator />
            ) : topMuscle ? (
              <View style={styles.rowAlign}>
                <MiniDonut
                  size={56}
                  percent={(topMuscle.pct_of_week ?? 0) / 100}
                  trackColor={"#E5E7EB22"}
                  progressColor={colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.bigText}
                    numberOfLines={1}
                    allowFontScaling={false}
                  >
                    {topMuscle.muscle_name}
                  </Text>
                  <Text style={styles.subtle}>
                    {Math.round(topMuscle.pct_of_week)}%
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.subtle}>Log a session to see focus.</Text>
            )}
          </View>

          <View style={[styles.gridCard, styles.gridCardEqual]}>
            <Text style={styles.cardTitle}>PERSONAL BEST</Text>
            {loading ? (
              <ActivityIndicator />
            ) : latestPR ? (
              <Text
                style={styles.bigText}
                numberOfLines={2}
                allowFontScaling={false}
              >
                New PR: {latestPR.exercise_name}{" "}
                {Number(latestPR.weight).toFixed(1)} kg × {latestPR.reps}
              </Text>
            ) : (
              <Text style={styles.subtle}>
                Hit a heavy set to register a PR.
              </Text>
            )}
          </View>
        </View>

        {/* Grid Row 2: Steps (sparkline) / Goal Progress */}
        <View style={styles.gridRow}>
          <View style={[styles.gridCard, styles.gridCardEqual]}>
            <Text style={styles.cardTitle}>STEPS - LAST 7 DAYS</Text>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Sparkline data={steps7} height={70} padding={8} />
                <View style={styles.weekLabels}>
                  {last7DayInitials().map((d, i) => (
                    <Text
                      key={i}
                      style={[styles.subtle, { opacity: 0.8 }]}
                      allowFontScaling={false}
                    >
                      {d}
                    </Text>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={[styles.gridCard, styles.gridCardEqual]}>
            <Text style={styles.cardTitle}>GOAL PROGRESS</Text>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text
                style={styles.bigText}
                numberOfLines={2}
                allowFontScaling={false}
              >
                {goalPctLabel}
              </Text>
            )}
          </View>
        </View>

        {/* Next Workout / Plan Section */}
        {/* Next Workout / Plan Section */}
        <NextContainer
          style={({ pressed }: any) => [
            styles.nextCard,
            canOpenNext && pressed
              ? { opacity: 0.95, transform: [{ scale: 0.997 }] }
              : null,
          ]}
          onPress={canOpenNext ? openNext : undefined}
        >
          <Text style={styles.cardTitle}>NEXT WORKOUT</Text>

          {loading ? (
            <ActivityIndicator />
          ) : !hasPlans ? (
            // No plans at all → CTA to create plan
            <>
              <Text style={styles.subtle}>
                Create a plan to enable Next Workout.
              </Text>
              <Pressable
                onPress={() => router.push("/features/plans/create/planInfo")}
                style={[
                  styles.button,
                  { backgroundColor: colors.primary, marginTop: 12 },
                ]}
              >
                <Text style={[styles.buttonText, { color: colors.background }]}>
                  Create a plan
                </Text>
              </Pressable>
            </>
          ) : !activePlanId ? (
            // Has plans but no active selected
            <Text style={styles.subtle}>
              You have plans but no active plan selected. Pick one in Plans.
            </Text>
          ) : nextIncompletePW ? (
            // Active plan & we have a next incomplete workout
            <>
              {/* Big title (only once) */}
              <Text style={[styles.nextTitle, { color: colors.successText }]}>
                {nextTitle}
              </Text>

              {/* Divider */}
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 10,
                }}
              />

              {/* Exercises only (no second title) */}
              <Text style={styles.pwExercises} numberOfLines={2}>
                {nextIncompletePW.exercises?.length
                  ? nextIncompletePW.exercises.join(" • ")
                  : "No exercises"}
              </Text>
            </>
          ) : (
            // All workouts completed and no fallback
            <Text style={styles.subtle}>All workouts completed this week.</Text>
          )}
        </NextContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

/** ---------------- Presentational helpers ---------------- */

/** Accurate circular ring using react-native-svg */
function SvgRing({
  size = 100,
  strokeWidth = 10,
  progress = 0, // raw value, can exceed 1
  trackColor,
  progressColor,
}: {
  size?: number;
  strokeWidth?: number;
  progress?: number;
  trackColor: string;
  progressColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const over = progress > 1;
  const clamped = Math.max(0, Math.min(1, progress));
  const dash = circumference * clamped;
  const gap = circumference - dash;

  return (
    <Svg width={size} height={size}>
      {/* Track */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress (if >1, still draw full ring but we’ll signal with color outside) */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={over ? progressColor : progressColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${dash},${gap}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}

function RingCard(props: {
  label: string;
  value: string;
  subValue?: string;
  percent: number; // can exceed 1
  colors: any;
  trackColor: string;
  progressColor: string;
  textColor: string;
}) {
  const {
    label,
    value,
    subValue,
    percent,
    colors,
    trackColor,
    progressColor,
    textColor,
  } = props;

  const over = percent > 1;
  const displayPct = Math.round(percent * 100);
  const centerText =
    displayPct > 100 ? `+${displayPct - 100}%` : `${displayPct}%`;
  const centerColor = over ? colors.successText : textColor;

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <SvgRing
        size={100}
        strokeWidth={10}
        progress={Math.max(0, percent)}
        trackColor={trackColor}
        progressColor={over ? colors.successText : progressColor}
      />
      <View style={{ position: "absolute", top: 28, alignItems: "center" }}>
        <Text style={{ color: centerColor, fontWeight: "900", fontSize: 18 }}>
          {centerText}
        </Text>
      </View>

      <Text style={{ color: textColor, fontWeight: "800", letterSpacing: 1.2 }}>
        {label}
      </Text>
      <Text
        style={{
          color: textColor,
          fontSize: 16,
          fontWeight: "800",
          textAlign: "center",
        }}
      >
        {value}
      </Text>
      {!!subValue && (
        <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>
          {subValue}
        </Text>
      )}
    </View>
  );
}

/** Mini donut for top muscle percent */
function MiniDonut({
  size = 56,
  percent = 0.32,
  trackColor = "#e5e7eb",
  progressColor = "#0b6aa9",
}: {
  size?: number;
  percent?: number; // 0..1
  trackColor?: string;
  progressColor?: string;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.max(0, Math.min(1, percent));
  const gap = circumference - dash;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={progressColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${dash},${gap}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}

function last7DayInitials(): string[] {
  const labels: string[] = [];
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const short = fmt.format(d); // e.g., "Mon"
    labels.push(short[0].toUpperCase()); // M/T/W/T/F/S/S
  }
  return labels;
}

/** Simple sparkline for 7-day steps (no axes) */
export function Sparkline({
  data,
  height = 70,
  stroke = "#93c5fd",
  padding = 8, // ← use this for BOTH the chart and the labels container
}: {
  data: number[];
  height?: number;
  stroke?: string;
  padding?: number;
}) {
  const [containerW, setContainerW] = React.useState(0);

  // Guard for layout
  const width = Math.max(160, containerW);

  const points = React.useMemo(() => {
    if (!Array.isArray(data) || data.length === 0 || width <= 0) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const span = Math.max(1, max - min);
    const n = data.length;

    return data
      .map((v, i) => {
        const x = padding + (i * (width - padding * 2)) / Math.max(1, n - 1);
        const y =
          height - padding - ((v - min) / span) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }, [data, height, padding, width]);

  return (
    <View
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      style={{ width: "100%" }}
    >
      <Svg width={width} height={height}>
        <Polyline points={points} fill="none" stroke={stroke} strokeWidth={3} />
      </Svg>
    </View>
  );
}

/** ---------------- Styles & utils ---------------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    button: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignSelf: "flex-start",
    },
    buttonText: {
      fontWeight: "800",
      fontSize: 14,
    },

    pwRow: {
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#00000020",
    },
    pwTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      maxWidth: "82%",
    },
    pwExercises: {
      color: colors.subtle,
      marginTop: 4,
    },
    badge: {
      fontWeight: "800",
      fontSize: 12,
    },

    headerCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
    },

    ringsCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    ringsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    ringCol: {
      width: "32%", // three equal columns
      alignItems: "center",
    },

    gridCardDark: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    nextCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    nextTitle: {
      fontSize: 24,
      fontWeight: "900",
    },

    gridRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },

    gridCard: {
      width: "48%", // two columns
      minWidth: 0, // prevent long text from widening card
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    // Same height cards per row. Adjust minHeight to taste (120–160 looks good).
    gridCardEqual: {
      minHeight: 140,
      justifyContent: "space-between", // keeps content balanced vertically
    },

    rowAlign: {
      flexDirection: "row",
      alignItems: "center",
      columnGap: 14, // RN 0.73+; if not supported, wrap children in a View with margins
    },

    weekLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 8, // must match Sparkline padding
      marginTop: 8,
    },

    cardTitle: {
      color: colors.subtle,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 10,
      textTransform: "uppercase",
    },

    bigText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 22,
    },

    subtle: { color: colors.subtle },
  });

function formatNumber(n: number) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}
