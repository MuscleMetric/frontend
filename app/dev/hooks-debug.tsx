// app/dev/hooks-debug.tsx
import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  TextStyle,
} from "react-native";
import { useAuth } from "../../lib/authContext";
import { useAppTheme } from "../../lib/useAppTheme";
import { useDeviceSteps } from "../../lib/hooks/useDeviceSteps";
import { useWeeklyHomeData } from "../../lib/hooks/useWeeklyHomeData";
import { useRouter } from "expo-router";

/** Tiny JSON pretty printer */
function PrettyJSON({ label, value }: { label: string; value: any }) {
  const str = React.useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontWeight: "900", marginBottom: 6 }}>{label}</Text>
      <View
        style={{ backgroundColor: "#0b6aa90D", borderRadius: 8, padding: 10 }}
      >
        <Text
          selectable
          style={{
            fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
          }}
        >
          {str}
        </Text>
      </View>
    </View>
  );
}

/** Status badge */
const Badge = ({ ok, text }: { ok: boolean; text: string }) => (
  <Text
    style={{
      alignSelf: "flex-start",
      backgroundColor: ok ? "#16a34a33" : "#ef444433",
      color: ok ? "#065f46" : "#7f1d1d",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      fontWeight: "800",
      marginBottom: 8,
    }}
  >
    {text}
  </Text>
);

export default function HooksDebug() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const router = useRouter();

  // Device steps hook
  const { stepsToday, stepsAvailable, stepsGoal, setStepsGoal } =
    useDeviceSteps(10000);

  // Weekly data hook (DB)
  const {
    loading,
    stepsGoalFromProfile,
    weeklyBasics,
    topMuscle,
    latestPR,
    nextWorkout,
    hasPlans,
    activePlanId,
    planWorkouts,
    steps7,
  } = useWeeklyHomeData(userId);

  // quick sanity checks (turn red if something is off)
  const checks = [
    { ok: !!userId, text: `userId: ${userId ?? "null"}` },
    { ok: !loading, text: loading ? "loading…" : "loaded" },
    {
      ok: typeof stepsGoalFromProfile === "number",
      text: `profiles.steps_goal: ${stepsGoalFromProfile ?? "null"}`,
    },
    { ok: !!weeklyBasics, text: `v_user_weekly_basics` },
    { ok: !!topMuscle, text: `v_user_top_muscle_this_week` },
    { ok: !!latestPR, text: `v_user_latest_pr` },
    { ok: !!nextWorkout, text: `v_user_next_workout` },
    { ok: hasPlans, text: `hasPlans: ${String(hasPlans)}` },
    { ok: !!activePlanId, text: `activePlanId: ${activePlanId ?? "null"}` },
    {
      ok: planWorkouts.length > 0,
      text: `planWorkouts: ${planWorkouts.length}`,
    },
    { ok: steps7.length === 7, text: `steps7 length: ${steps7.length}` },
  ];

  const btnTxt = (colors: any): TextStyle => ({
    color: colors.background,
    fontWeight: "900", // now typed correctly
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: 22,
          fontWeight: "900",
          marginBottom: 12,
        }}
      >
        Hooks Debug
      </Text>

      {/* Quick statuses */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {checks.map((c, i) => (
          <Badge key={i} ok={c.ok} text={c.text} />
        ))}
      </View>

      {/* Handy actions */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <Pressable
          onPress={() => setStepsGoal(Math.max(0, stepsGoal + 1000))}
          style={btn(colors)}
        >
          <Text style={btnTxt(colors)}>+1k steps goal</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/features/plans/create/planInfo")}
          style={btn(colors)}
        >
          <Text style={btnTxt(colors)}>Create plan</Text>
        </Pressable>
      </View>

      {/* Device steps hook */}
      <PrettyJSON
        label="useDeviceSteps()"
        value={{ stepsToday, stepsAvailable, stepsGoal }}
      />

      {/* Weekly data hook */}
      <PrettyJSON
        label="useWeeklyHomeData() → basics"
        value={{ loading, stepsGoalFromProfile, weeklyBasics }}
      />
      <PrettyJSON label="topMuscle" value={topMuscle} />
      <PrettyJSON label="latestPR" value={latestPR} />
      <PrettyJSON label="nextWorkout" value={nextWorkout} />
      <PrettyJSON
        label="planWorkouts (first 2)"
        value={planWorkouts.slice(0, 2)}
      />
      <PrettyJSON label="steps7" value={steps7} />

      {/* Navigation smoke test: go to first plan workout */}
      {planWorkouts[0]?.workout_id && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/features/workouts/view",
              params: {
                workoutId: String(planWorkouts[0].workout_id),
                planWorkoutId: String(planWorkouts[0].id),
              },
            })
          }
          style={[btn(colors), { marginTop: 12 }]}
        >
          <Text style={btnTxt(colors)}>Open first workout</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const btn = (colors: any) => ({
  backgroundColor: colors.primary,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 12,
});
const btnTxt = (colors: any) => ({
  color: colors.background,
  fontWeight: "900",
});
