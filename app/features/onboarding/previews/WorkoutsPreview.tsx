import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useAppTheme } from "../../../../lib/useAppTheme";

/* ---------- demo types ---------- */
type DemoPlan = {
  title: string;
  endText: string;
  completedCount: number;
  totalExpected: number;
};

type DemoPlanWorkout = {
  id: string;
  title: string;
  highlights: string;
  weekly_complete: boolean;
};

type DemoStandaloneWorkout = {
  id: string;
  title: string;
  highlights: string;
  notes?: string | null;
};

/* ---------- ProgressRing ---------- */
function progressColor(pct: number, colors: any) {
  if (pct < 40) return colors.danger ?? "#ef4444";
  if (pct < 80) return colors.warnText ?? "#f59e0b";
  return colors.successText ?? "#22c55e";
}

function ProgressRing({
  size = 72,
  stroke = 8,
  pct = 0,
  colors,
}: {
  size?: number;
  stroke?: number;
  pct: number;
  colors: any;
}) {
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={radius} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={progressColor(clamped, colors)}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <Text style={{ position: "absolute", fontWeight: "900", color: colors.text }}>
        {Math.round(clamped)}%
      </Text>
    </View>
  );
}

/* ---------- Sheet modal (pure UI) ---------- */
function WorkoutCreateOptionsModal({
  visible,
  onClose,
  onAuto,
  onManual,
}: {
  visible: boolean;
  onClose: () => void;
  onAuto: () => void;
  onManual: () => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={s.sheetTitle}>How do you want to create it?</Text>
          <Text style={s.sheetSub}>
            You can build a workout from scratch or let MuscleMetric guide you.
          </Text>

          <Pressable style={[s.sheetBtn, s.sheetBtnPrimary]} onPress={onAuto}>
            <Text style={s.sheetBtnPrimaryText}>Generate a workout for me</Text>
            <Text style={s.sheetBtnCaption}>
              Answer a few questions and we’ll build a workout.
            </Text>
          </Pressable>

          <Pressable style={s.sheetBtn} onPress={onManual}>
            <Text style={s.sheetBtnText}>Build my own workout</Text>
            <Text style={s.sheetBtnCaption}>
              Choose exercises and structure everything yourself.
            </Text>
          </Pressable>

          <Pressable style={s.closeLink} onPress={onClose}>
            <Text style={s.closeLinkText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- UI bits ---------- */
function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.sectionHeader}>
      <Text style={s.h2}>{title}</Text>
      {right}
    </View>
  );
}

function PillButton({
  label,
  onPress,
  tone = "default",
}: {
  label: string;
  onPress: () => void;
  tone?: "default" | "primary" | "warning";
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const styleByTone =
    tone === "primary"
      ? {
          bg: colors.primaryBg ?? `${colors.primary}22`,
          fg: colors.primaryText ?? colors.primary,
          border: colors.primary ?? colors.border,
        }
      : tone === "warning"
      ? {
          bg: colors.warnBg ?? "rgba(245,158,11,0.16)",
          fg: colors.warnText ?? "#f59e0b",
          border: colors.warnText ?? "#f59e0b",
        }
      : { bg: colors.surface, fg: colors.text, border: colors.border };

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.pill,
        {
          backgroundColor: styleByTone.bg,
          borderColor: styleByTone.border,
        },
      ]}
    >
      <Text style={{ fontWeight: "800", color: styleByTone.fg }}>{label}</Text>
    </Pressable>
  );
}

function PlanWorkoutItem({
  title,
  highlights,
  weeklyComplete,
  onPress,
}: {
  title: string;
  highlights: string;
  weeklyComplete: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.card,
        s.rowCard,
        weeklyComplete && {
          backgroundColor: colors.successBg ?? "rgba(34,197,94,0.12)",
          borderColor: colors.successText ?? "#22c55e",
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            s.h3,
            weeklyComplete && { color: colors.successText ?? "#22c55e" },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!highlights && (
          <Text style={[s.muted, { marginTop: 4 }]} numberOfLines={2}>
            {highlights}
          </Text>
        )}
      </View>

      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {weeklyComplete ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.successBg ?? "rgba(34,197,94,0.14)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.successText ?? "#22c55e",
            }}
          >
            <Text style={{ color: colors.successText ?? "#22c55e", fontWeight: "900", fontSize: 12 }}>
              ✓ Completed
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.subtle, fontWeight: "900" }}>›</Text>
        )}
      </View>
    </Pressable>
  );
}

function WorkoutCard({
  title,
  highlights,
  notes,
  onPress,
}: {
  title: string;
  highlights: string;
  notes?: string | null;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress} style={[s.card, s.rowCard]}>
      <View style={{ flex: 1 }}>
        <Text style={s.h3} numberOfLines={1}>
          {title}
        </Text>

        {!!highlights && (
          <Text style={[s.muted, { marginTop: 4 }]} numberOfLines={2}>
            {highlights}
          </Text>
        )}

        {!!notes && (
          <Text style={[s.muted, { marginTop: 6 }]} numberOfLines={2}>
            “{notes}”
          </Text>
        )}
      </View>

      <Text style={{ color: colors.subtle, fontWeight: "900" }}>›</Text>
    </Pressable>
  );
}

/* ---------- Preview Screen ---------- */
export function WorkoutsPreview() {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [showCreateOptions, setShowCreateOptions] = useState(false);

  // ✅ Demo: active plan + 3 workouts
  const plan: DemoPlan = {
    title: "Strength Block — 4 Weeks",
    endText: "Ends: Feb 3, 2026",
    completedCount: 5,
    totalExpected: 12, // 3/week × 4 weeks
  };

  const planWorkouts: DemoPlanWorkout[] = [
    {
      id: "pw-1",
      title: "Push A (Strength)",
      highlights: "Bench Press, Incline DB, Fly, Triceps",
      weekly_complete: true, // ✅ lockout example
    },
    {
      id: "pw-2",
      title: "Pull A (Strength)",
      highlights: "Pull Up, Row, Lat Pulldown, Biceps",
      weekly_complete: false,
    },
    {
      id: "pw-3",
      title: "Legs A (Strength)",
      highlights: "Squat, RDL, Leg Press, Calves",
      weekly_complete: false,
    },
  ];

  const standalone: DemoStandaloneWorkout[] = [
    {
      id: "sw-1",
      title: "Quick Upper Pump",
      highlights: "Chest, Back, Shoulders, Arms",
      notes: "30–40 mins. Keep rest short.",
    },
    {
      id: "sw-2",
      title: "Cardio + Core",
      highlights: "Bike, Plank, Hanging Leg Raise",
      notes: "Zone 2 for 20 mins then core finisher.",
    },
    {
      id: "sw-3",
      title: "Glutes Focus",
      highlights: "Hip Thrust, RDL, Abduction, Split Squat",
      notes: null,
    },
  ];

  const pctComplete = plan.totalExpected
    ? Math.min(100, (plan.completedCount / plan.totalExpected) * 100)
    : 0;

  const onPlanWorkoutPress = (pw: DemoPlanWorkout) => {
    if (pw.weekly_complete) {
      Alert.alert("Workout Completed", "You’ve already completed this workout for the week.");
      return;
    }
    Alert.alert("Preview", `Would open: ${pw.title}`);
  };

  const onStandalonePress = (w: DemoStandaloneWorkout) => {
    Alert.alert("Preview", `Would open: ${w.title}`);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Plan summary card */}
      <View style={s.card}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.planTitle} numberOfLines={1}>
              {plan.title}
            </Text>
            <Text style={s.muted}>{plan.endText}</Text>

            <Text style={[s.muted, { marginTop: 2 }]}>
              {plan.completedCount} of {plan.totalExpected} workouts completed
            </Text>

            <Text style={[s.muted, { marginTop: 2 }]}>
              (3 per week × 4 weeks)
            </Text>
          </View>

          <ProgressRing pct={pctComplete} colors={colors} />
        </View>
      </View>

      {/* Plan list */}
      <View style={s.section}>
        <SectionHeader
          title="Plan"
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PillButton label="View" onPress={() => Alert.alert("Preview", "Would open plan view")} />
              <PillButton label="Edit" tone="warning" onPress={() => Alert.alert("Preview", "Would open plan editor")} />
            </View>
          }
        />

        <View style={{ gap: 10 }}>
          {planWorkouts.map((pw) => (
            <PlanWorkoutItem
              key={pw.id}
              title={pw.title}
              highlights={pw.highlights}
              weeklyComplete={pw.weekly_complete}
              onPress={() => onPlanWorkoutPress(pw)}
            />
          ))}
        </View>
      </View>

      {/* Standalone workouts */}
      <View style={s.section}>
        <SectionHeader
          title="Workouts"
          right={
            <PillButton
              label="Create Workout"
              tone="primary"
              onPress={() => setShowCreateOptions(true)}
            />
          }
        />

        <View style={{ gap: 12 }}>
          {standalone.map((w) => (
            <WorkoutCard
              key={w.id}
              title={w.title}
              highlights={w.highlights}
              notes={w.notes ?? null}
              onPress={() => onStandalonePress(w)}
            />
          ))}
        </View>

        <View style={s.tip}>
          <Text style={s.tipTitle}>Tip</Text>
          <Text style={s.tipText}>
            Save workouts you repeat, or turn them into a plan to track weekly goals and streaks.
          </Text>
        </View>
      </View>

      {/* Create options modal (UI only) */}
      <WorkoutCreateOptionsModal
        visible={showCreateOptions}
        onClose={() => setShowCreateOptions(false)}
        onAuto={() => {
          setShowCreateOptions(false);
          Alert.alert("Preview", "Would open: Auto-generate workout flow");
        }}
        onManual={() => {
          setShowCreateOptions(false);
          Alert.alert("Preview", "Would open: Manual workout builder");
        }}
      />
    </ScrollView>
  );
}

/* ---------- themed styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    h1: { color: colors.text, fontSize: 24, fontWeight: "900" },

    section: { gap: 10 },
    sectionHeader: {
      paddingHorizontal: 2,
      paddingVertical: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      gap: 6,
    },

    // slightly more list-like card (matches your tab vibe)
    rowCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },

    planTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },

    muted: { color: colors.subtle, fontWeight: "700" },

    h2: { fontSize: 16, fontWeight: "900", color: colors.text },
    h3: { fontSize: 15, fontWeight: "900", color: colors.text },

    pill: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface,
    },

    tip: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(14,165,233,0.35)",
      backgroundColor: "rgba(14,165,233,0.12)",
      padding: 14,
      gap: 6,
    },
    tipTitle: { color: colors.text, fontWeight: "900" },
    tipText: { color: colors.subtle, fontWeight: "800" },

    /* ----- modal styles (copied vibe from your tab) ----- */
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    sheet: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    sheetSub: {
      fontSize: 13,
      color: colors.subtle,
      marginBottom: 14,
      fontWeight: "600",
    },
    sheetBtn: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 10,
    },
    sheetBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sheetBtnText: {
      fontWeight: "800",
      color: colors.text,
      fontSize: 15,
    },
    sheetBtnPrimaryText: {
      fontWeight: "900",
      color: "#fff",
      fontSize: 15,
    },
    sheetBtnCaption: {
      marginTop: 4,
      fontSize: 12,
      color: colors.subtle,
      fontWeight: "600",
    },
    closeLink: {
      marginTop: 6,
      alignSelf: "center",
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    closeLinkText: {
      color: colors.subtle,
      fontWeight: "700",
    },
  });
