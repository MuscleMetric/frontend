// app/(tabs)/workout.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { router } from "expo-router";
import { useAppTheme } from "../../lib/useAppTheme";
import { useFocusEffect } from "@react-navigation/native";

/* ---------- types ---------- */
type Plan = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

type PlanWorkoutRow = {
  id: string;
  title: string | null;
  order_index: number | null;
  weekly_complete: boolean | null;
  workout_id: string;
  workouts: {
    id: string;
    workout_exercises: Array<{
      order_index: number | null;
      exercises: { name: string | null } | null;
    }>;
  } | null;
};

type Workout = {
  id: string;
  title: string | null;
  notes: string | null;
};

/* ---------- utils ---------- */
function weeksBetween(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return 1;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 1;
  const weeks = (e - s) / (1000 * 60 * 60 * 24 * 7);
  return Math.max(1, Math.round(weeks));
}

function progressColor(pct: number, colors: any) {
  if (pct < 40) return colors.danger;
  if (pct < 80) return colors.warnText;
  return colors.successText;
}

/* ---------- ProgressRing ---------- */
function ProgressRing({
  size = 64,
  stroke = 8,
  pct = 0,
  colors,
}: {
  size?: number;
  stroke?: number;
  pct: number; // 0..100
  colors: any;
}) {
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const dashOffset = circumference * (1 - clamped / 100);
  const color = progressColor(clamped, colors);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <Text
        style={{ position: "absolute", fontWeight: "800", color: colors.text }}
      >
        {Math.round(clamped)}%
      </Text>
    </View>
  );
}

/* ---------- Screen ---------- */
export default function WorkoutScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id || null;

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkoutRow[]>([]);
  const [looseWorkouts, setLooseWorkouts] = useState<Workout[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);

  const endText = useMemo(() => {
    if (!plan?.end_date) return null;
    try {
      const d = new Date(plan.end_date);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return plan.end_date;
    }
  }, [plan?.end_date]);

  const load = useCallback(async () => {
    if (!userId) return;
    let cancelled = false;

    try {
      setLoading(true);

      // 1) Active plan (else most recent)
      let { data: activePlan, error: pErr } = await supabase
        .from("plans")
        .select("id, title, start_date, end_date, is_completed")
        .eq("user_id", userId)
        .eq("is_completed", false)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activePlan && !pErr) {
        const { data } = await supabase
          .from("plans")
          .select("id, title, start_date, end_date, is_completed")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        activePlan = data ?? null;
      }

      if (cancelled) return;
      setPlan(activePlan ?? null);

      // 2) plan_workouts + nested exercises
      let planWorkoutIds: string[] = [];
      if (activePlan?.id) {
        const { data: pws, error: pwErr } = await supabase
          .from("plan_workouts")
          .select(
            `
              id, title, order_index, weekly_complete, workout_id,
              workouts!inner (
                id,
                workout_exercises (
                  order_index,
                  exercises ( name )
                )
              )
            `
          )
          .eq("plan_id", activePlan.id)
          .order("order_index", { ascending: true });

        if (!pwErr) {
          const rows: PlanWorkoutRow[] = (pws ?? []).map((r: any) => {
            const w = Array.isArray(r.workouts) ? r.workouts[0] : r.workouts;
            return {
              id: String(r.id),
              title: r.title ?? null,
              order_index: r.order_index ?? null,
              weekly_complete: r.weekly_complete ?? null,
              workout_id: String(r.workout_id),
              workouts: w
                ? {
                    id: String(w.id),
                    workout_exercises: (w.workout_exercises ?? []).map(
                      (we: any) => ({
                        order_index: we?.order_index ?? null,
                        exercises: we?.exercises
                          ? { name: we.exercises.name ?? null }
                          : null,
                      })
                    ),
                  }
                : null,
            };
          });

          if (!cancelled) {
            setPlanWorkouts(rows);
            planWorkoutIds = rows.map((r) => r.workout_id);
          }
        }

        // 3) Completed count for those workouts
        if (planWorkoutIds.length && !cancelled) {
          const { count } = await supabase
            .from("workout_history")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .in("workout_id", planWorkoutIds);
          if (!cancelled) setCompletedCount(count ?? 0);
        } else if (!cancelled) {
          setCompletedCount(0);
        }
      } else {
        if (!cancelled) {
          setPlanWorkouts([]);
          setCompletedCount(0);
        }
      }

      // 4) Loose workouts
      if (!cancelled) {
        if (planWorkoutIds.length) {
          const { data: loose } = await supabase
            .from("workouts")
            .select("id, title, notes")
            .eq("user_id", userId)
            .not(
              "id",
              "in",
              `(${planWorkoutIds.map((id) => `'${id}'`).join(",")})`
            )
            .order("updated_at", { ascending: false })
            .limit(20);
          if (!cancelled) setLooseWorkouts(loose ?? []);
        } else {
          const { data: loose } = await supabase
            .from("workouts")
            .select("id, title, notes")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(20);
          if (!cancelled) setLooseWorkouts(loose ?? []);
        }
      }
    } catch (e) {
      console.warn("workout tab load error:", e);
      if (!cancelled) {
        setPlan(null);
        setPlanWorkouts([]);
        setLooseWorkouts([]);
        setCompletedCount(0);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // initial load
  useEffect(() => {
    load();
  }, [load]);

  // refresh when tab/screen regains focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const buildHighlights = useCallback((row: PlanWorkoutRow): string => {
    const exs =
      row.workouts?.workout_exercises
        ?.slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((we) => we.exercises?.name || "")
        .filter(Boolean) ?? [];
    return exs.slice(0, 4).join(", ");
  }, []);

  /* ---------- states ---------- */
  if (!userId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>
          Please log in to view your workouts.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  // Empty state
  if (!plan && looseWorkouts.length === 0) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <CalloutCard
          title="Create your first plan"
          subtitle="Build a routine with targeted workouts, then track your progress."
          primary="Create Plan"
          onPrimary={() => router.push("/features/plans/create/planInfo")}
          secondary="Or add a single workout"
          onSecondary={() =>
            Alert.alert("Create Workout", "Workout creator coming soon.")
          }
        />
      </ScrollView>
    );
  }

  const workoutsPerWeekPlanned = planWorkouts.length;
  const planWeeks = weeksBetween(plan?.start_date, plan?.end_date);
  const totalExpected = workoutsPerWeekPlanned * planWeeks;
  const pctComplete = totalExpected
    ? Math.min(100, (completedCount / totalExpected) * 100)
    : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      {/* Plan summary */}
      {plan && (
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.planTitle}>{plan.title ?? "My Plan"}</Text>
              <Text style={styles.muted}>
                {endText ? `Ends: ${endText}` : "No end date set"}
              </Text>
              <Text style={[styles.muted, { marginTop: 2 }]}>
                {completedCount} of {totalExpected} workouts completed
              </Text>
              <Text style={[styles.muted, { marginTop: 2 }]}>
                ({workoutsPerWeekPlanned || 0} per week × {planWeeks} weeks)
              </Text>
            </View>

            <ProgressRing
              size={72}
              stroke={8}
              pct={pctComplete}
              colors={colors}
            />
          </View>
        </View>
      )}

      {/* Plan workout list */}
      {plan && (
        <View style={styles.section}>
          <SectionHeader
            title="Plan"
            right={
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PillButton
                  label="View"
                  onPress={() => {
                    if (plan?.id) {
                      router.push({
                        pathname: "/features/plans/view",
                        params: { planId: plan.id },
                      });
                    } else {
                      Alert.alert(
                        "No plan",
                        "There isn't an active plan to view yet."
                      );
                    }
                  }}
                />
                <PillButton
                  label="Edit"
                  tone="warning"
                  onPress={() => {
                    if (plan?.id) {
                      router.push({
                        pathname: "/features/plans/edit",
                        params: { planId: plan.id },
                      });
                    } else {
                      Alert.alert(
                        "No plan",
                        "There isn't an active plan to edit yet."
                      );
                    }
                  }}
                />
              </View>
            }
          />
          <View style={{ gap: 10 }}>
            {planWorkouts.map((pw) => (
              <PlanWorkoutItem
                key={pw.id}
                title={pw.title ?? "Workout"}
                highlights={buildHighlights(pw)}
                completed={false}
                onPress={() =>
                  Alert.alert("Open Workout", pw.title ?? "Workout")
                }
              />
            ))}
            {planWorkouts.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.muted}>No workouts in this plan yet.</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Standalone workouts */}
      <View style={styles.section}>
        <SectionHeader
          title="Workouts"
          right={
            <PillButton
              label="Create Workout"
              tone="primary"
              onPress={() =>
                Alert.alert("Create Workout", "Workout creator coming soon.")
              }
            />
          }
        />
        <View style={{ gap: 12 }}>
          {looseWorkouts.map((w) => (
            <WorkoutCard
              key={w.id}
              title={w.title ?? "Untitled Workout"}
              notes={w.notes ?? null}
              onPress={() => Alert.alert("Open Workout", w.title ?? "Workout")}
            />
          ))}
          {looseWorkouts.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.muted}>No standalone workouts yet.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- presentation bits (themed) ---------- */
function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.h2}>{title}</Text>
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
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const styleByTone =
    tone === "primary"
      ? { bg: colors.primaryBg, fg: colors.primaryText }
      : tone === "warning"
      ? { bg: colors.warnBg, fg: colors.warnText }
      : { bg: colors.surface, fg: colors.text };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, { backgroundColor: styleByTone.bg }]}
    >
      <Text style={{ fontWeight: "700", color: styleByTone.fg }}>{label}</Text>
    </Pressable>
  );
}

function PlanWorkoutItem({
  title,
  highlights,
  completed,
  onPress,
}: {
  title: string;
  highlights: string;
  completed: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, completed && styles.completedCard]}
    >
      <Text style={[styles.h3, completed && { color: colors.successText }]}>
        {title}
        {completed ? "  ✓ Completed" : ""}
      </Text>
      {!!highlights && <Text style={styles.muted}>{highlights}</Text>}
    </Pressable>
  );
}

function WorkoutCard({
  title,
  notes,
  onPress,
}: {
  title: string;
  notes: string | null;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={styles.h3}>{title}</Text>
      </View>
      <Text style={styles.muted}>
        {notes ? (notes.length > 80 ? notes.slice(0, 80) + "…" : notes) : "—"}
      </Text>
    </Pressable>
  );
}

function CalloutCard({
  title,
  subtitle,
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: {
  title: string;
  subtitle?: string;
  primary: string;
  secondary?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.muted, { marginTop: 4 }]}>{subtitle}</Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <PillButton label={primary} onPress={onPrimary} tone="primary" />
        {secondary ? (
          <PillButton label={secondary} onPress={onSecondary!} />
        ) : null}
      </View>
    </View>
  );
}

/* ---------- themed styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
    },
    completedCard: {
      backgroundColor: colors.successBg,
      borderColor: colors.successText,
    },

    planTitle: {
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
      color: colors.text,
    },
    muted: { color: colors.subtle },
    h2: { fontSize: 16, fontWeight: "800", color: colors.text },
    h3: { fontSize: 15, fontWeight: "700", color: colors.text },

    pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  });
