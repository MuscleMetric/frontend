import React, { useEffect, useMemo } from "react";
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
import { Pedometer } from "expo-sensors";
import {
  registerBackgroundFetch,
  onAppActiveSync,
} from "../features/steps/stepsSync";

export default function Home() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
            disabled={loading}
            onPress={() => router.push("/features/goals/goals")} // ← per your request
            style={styles.gridCard}
          >
            {/* If you have a GoalProgressCard, drop it here; else simple text */}
            <Text style={styles.title}>GOAL PROGRESS</Text>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.bigText}>{goalPctLabel}</Text>
            )}
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
  });
