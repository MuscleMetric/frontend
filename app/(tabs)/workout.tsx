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
  Modal,
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

type StandaloneWorkoutRow = {
  id: string;
  title: string | null;
  notes: string | null;
  plan_workouts?: { id: string }[] | null;
  workout_exercises?:
    | {
        order_index: number | null;
        exercises: { name: string | null } | null;
      }[]
    | null;
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

function WorkoutCreateOptionsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const goManual = () => {
    onClose();
    router.push("/features/workouts/create");
  };

  const goAuto = () => {
    onClose();
    router.push("/features/workouts/create/auto-create");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()} // prevent closing when tapping content
        >
          <Text style={styles.sheetTitle}>How do you want to create it?</Text>
          <Text style={styles.sheetSub}>
            You can build a workout from scratch or let MuscleMetric guide you.
          </Text>

          <Pressable
            style={[styles.sheetBtn, styles.sheetBtnPrimary]}
            onPress={goAuto}
          >
            <Text style={styles.sheetBtnPrimaryText}>
              Generate a workout for me
            </Text>
            <Text style={styles.sheetBtnCaption}>
              Answer a few questions and we’ll build a workout.
            </Text>
          </Pressable>

          <Pressable style={styles.sheetBtn} onPress={goManual}>
            <Text style={styles.sheetBtnText}>Build my own workout</Text>
            <Text style={styles.sheetBtnCaption}>
              Choose exercises and structure everything yourself.
            </Text>
          </Pressable>

          <Pressable style={styles.closeLink} onPress={onClose}>
            <Text style={styles.closeLinkText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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

  const [standaloneWorkouts, setStandaloneWorkouts] = useState<
    StandaloneWorkoutRow[]
  >([]);
  const [loadingStandalone, setLoadingStandalone] = useState(false);
  const [standaloneError, setStandaloneError] = useState<string | null>(null);

  const [showCreateOptions, setShowCreateOptions] = useState(false);

  const loadStandalone = useCallback(async () => {
    if (!userId) {
      setStandaloneWorkouts([]);
      return;
    }

    let cancelled = false;
    setLoadingStandalone(true);
    setStandaloneError(null);

    try {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          `
        id,
        title,
        notes,
        plan_workouts:plan_workouts!left(
          id
        ),
        workout_exercises(
          order_index,
          exercises (
            name
          )
        )
      `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (cancelled) return;

      const all = (data ?? []).map(
        (row: any): StandaloneWorkoutRow => ({
          id: String(row.id),
          title: row.title ?? null,
          notes: row.notes ?? null,
          plan_workouts: row.plan_workouts ?? [],
          workout_exercises: (row.workout_exercises ?? []).map((we: any) => ({
            order_index: we?.order_index ?? null,
            exercises: we?.exercises
              ? { name: we.exercises.name ?? null }
              : null,
          })),
        })
      );

      // keep only workouts NOT tied to any plan
      const standalone = all.filter(
        (w) => !w.plan_workouts || w.plan_workouts.length === 0
      );

      setStandaloneWorkouts(standalone);
    } catch (e: any) {
      if (!cancelled) {
        console.warn("load standalone workouts error", e);
        setStandaloneError(e?.message ?? "Could not load workouts.");
        setStandaloneWorkouts([]);
      }
    } finally {
      if (!cancelled) setLoadingStandalone(false);
    }

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    loadStandalone();
  }, [loadStandalone]);

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

      // -------------------------
      // 0) Get active_plan_id + timezone (source of truth)
      // -------------------------
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("active_plan_id, timezone")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      const activePlanId = profile?.active_plan_id ?? null;
      const userTz = profile?.timezone ?? "UTC";

      // -------------------------
      // 1) Active plan (ONLY via active_plan_id)
      // -------------------------
      let activePlan: any = null;

      if (activePlanId) {
        const { data: p, error: pErr } = await supabase
          .from("plans")
          .select(
            "id, title, start_date, end_date, is_completed, completed_at, created_at"
          )
          .eq("id", activePlanId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!pErr && p && p.is_completed === false) {
          activePlan = p;
        } else {
          // Safety net: active_plan_id exists but plan is missing/completed -> clear local state
          activePlan = null;
        }
      }

      if (cancelled) return;
      setPlan(activePlan);

      // -------------------------
      // 2) plan_workouts + nested exercises (only if active plan)
      // -------------------------
      let planWorkoutIds: string[] = [];

      if (activePlan?.id) {
        const { data: pws, error: pwErr } = await supabase
          .from("plan_workouts")
          .select(
            `
            id, title, order_index, weekly_complete, workout_id, is_archived,
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
          .eq("is_archived", false)
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

        // -------------------------
        // 3) Completed count for those workouts
        // -------------------------
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

      // -------------------------
      // 4) Loose workouts (unchanged)
      // -------------------------
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

      // -------------------------
      // 5) Check for "plan_completed" event for modal (do NOT consume here)
      // -------------------------
      if (!cancelled) {
        const { data: evt } = await supabase
          .from("user_events")
          .select("id, type, payload, created_at")
          .eq("user_id", userId)
          .eq("type", "plan_completed")
          .is("consumed_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
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

  useFocusEffect(
    useCallback(() => {
      load(); // existing plan + loose logic
      loadStandalone(); // NEW: refresh standalone list as well
    }, [load, loadStandalone])
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

  const buildStandaloneHighlights = useCallback(
    (row: StandaloneWorkoutRow): string => {
      const exs =
        row.workout_exercises
          ?.slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((we) => we.exercises?.name || "")
          .filter(Boolean) ?? [];

      return exs.slice(0, 4).join(", ");
    },
    []
  );

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

  // Empty state: no plan and no workouts yet
  if (!plan && !loadingStandalone && standaloneWorkouts.length === 0) {
    return (
      <>
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16, gap: 16 }}
        >
          <CalloutCard
            title="Start with a plan or a workout"
            subtitle="Build a routine you can reuse, or just log a single workout to begin."
            primary="Create a plan"
            onPrimary={() => router.push("/features/plans/create/planInfo")}
            secondary="Or add a single workout"
            onSecondary={() => setShowCreateOptions(true)}
          />
        </ScrollView>

        <WorkoutCreateOptionsModal
          visible={showCreateOptions}
          onClose={() => setShowCreateOptions(false)}
        />
      </>
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
                completed={!!pw.weekly_complete}
                onPress={() => {
                  if (pw.weekly_complete) {
                    Alert.alert(
                      "Workout Completed",
                      "You’ve already completed this workout for the week."
                    );
                  } else {
                    router.push({
                      pathname: "/features/workouts/view",
                      params: {
                        workoutId: pw.workout_id,
                        planWorkoutId: pw.id,
                      },
                    });
                  }
                }}
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

      {/* No plan yet, but user has standalone workouts */}
      {!plan && standaloneWorkouts.length > 0 && (
        <View style={styles.section}>
          <CalloutCard
            title="Turn these workouts into a plan"
            subtitle="Plans help you set a weekly target, track streaks, and stay consistent."
            primary="Create a plan"
            onPrimary={() => router.push("/features/plans/create/planInfo")}
            secondary="Keep using single workouts"
            onSecondary={() => setShowCreateOptions(true)}
          />
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
              onPress={() => setShowCreateOptions(true)}
            />
          }
        />

        {/* ...your existing list / content... */}

        <WorkoutCreateOptionsModal
          visible={showCreateOptions}
          onClose={() => setShowCreateOptions(false)}
        />

        {loadingStandalone ? (
          <ActivityIndicator />
        ) : standaloneError ? (
          <View style={styles.card}>
            <Text style={[styles.muted, { color: colors.danger ?? "#ef4444" }]}>
              {standaloneError}
            </Text>
          </View>
        ) : standaloneWorkouts.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No standalone workouts yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {standaloneWorkouts.map((w) => {
              const highlights = buildStandaloneHighlights(w);
              return (
                <WorkoutCard
                  key={w.id}
                  title={w.title ?? "Untitled Workout"}
                  notes={w.notes ?? null}
                  highlights={highlights}
                  onPress={() =>
                    router.push({
                      pathname: "/features/workouts/use",
                      params: { workoutId: w.id },
                    })
                  }
                />
              );
            })}
          </View>
        )}
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
  highlights,
  onPress,
}: {
  title: string;
  notes: string | null;
  highlights?: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { position: "relative" }]}
    >
      <Text style={styles.h3}>{title}</Text>

      {/* Exercise list */}
      {highlights ? (
        <Text style={[styles.muted, { marginTop: 4 }]}>{highlights}</Text>
      ) : null}
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
      fontWeight: "700",
      color: colors.text,
      fontSize: 15,
    },
    sheetBtnPrimaryText: {
      fontWeight: "800",
      color: "#fff",
      fontSize: 15,
    },
    sheetBtnCaption: {
      marginTop: 4,
      fontSize: 12,
      color: colors.subtle,
    },
    closeLink: {
      marginTop: 6,
      alignSelf: "center",
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    closeLinkText: {
      color: colors.subtle,
      fontWeight: "600",
    },
  });
