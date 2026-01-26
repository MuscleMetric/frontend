// app/features/plans/view.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { Share } from "react-native";
import * as SMS from "expo-sms";
import * as Linking from "expo-linking";
import { Share2 } from "lucide-react-native";

import { useAuth } from "../../../lib/authContext";
import { supabase } from "../../../lib/supabase";
import { useAppTheme } from "../../../lib/useAppTheme";

import { Card, Button, Pill, Screen, ScreenHeader } from "@/ui";

type PlanRow = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

type WorkoutWithExercises = {
  id: string;
  title: string | null;
  workout_exercises: Array<{
    order_index: number | null;
    superset_group?: string | null;
    supersetGroup?: string | null;
    is_dropset?: boolean | null;
    isDropset?: boolean | null;
    exercises: { name: string | null } | null;
  }>;
};

type PlanWorkoutRow = {
  id: string;
  title: string | null;
  workouts: WorkoutWithExercises | null;
};

type GoalRow = {
  id: string;
  type: "exercise_weight" | "exercise_reps" | "distance" | "time";
  target_number: number;
  unit: string | null;
  deadline: string | null;
  exercises: { name: string | null } | null;
  notes: string | null; // json: { start?: number }
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
}

function weeksBetween(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return 1;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 1;
  const weeks = (e - s) / (1000 * 60 * 60 * 24 * 7);
  return Math.max(1, Math.round(weeks));
}

function labelForMode(m: GoalRow["type"]) {
  switch (m) {
    case "exercise_weight":
      return "Weight";
    case "exercise_reps":
      return "Reps";
    case "distance":
      return "Distance";
    case "time":
      return "Time";
  }
}

function parseStart(notes?: string | null): number | null {
  if (!notes) return null;
  try {
    const obj = JSON.parse(notes);
    if (typeof obj?.start === "number") return obj.start;
  } catch {}
  return null;
}

export default function PlanView() {
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, typography, layout } = useAppTheme();
  const s = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkoutRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  function buildWorkoutsBlock() {
    if (!planWorkouts.length) return "No workouts in this plan.";
    const lines: string[] = [];
    planWorkouts.forEach((pw, i) => {
      const w = pw.workouts;
      const exs = (w?.workout_exercises ?? [])
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      // establish superset order
      const order: string[] = [];
      const seen = new Set<string>();
      exs.forEach((e) => {
        const gid = (e.superset_group ?? (e as any).supersetGroup) || null;
        if (gid && !seen.has(gid)) {
          order.push(gid);
          seen.add(gid);
        }
      });

      const rendered = new Set<number>();
      const rows: string[] = [];
      exs.forEach((e, idx) => {
        if (rendered.has(idx)) return;

        const gid = (e.superset_group ?? (e as any).supersetGroup) || null;
        const name = e.exercises?.name ?? "Exercise";
        const isDrop = !!(e.is_dropset ?? (e as any).isDropset);

        if (gid) {
          const members = exs
            .map((x, j) => ({ x, j }))
            .filter(({ x }) => (x.superset_group ?? (x as any).supersetGroup) === gid)
            .sort((a, b) => (a.x.order_index ?? 0) - (b.x.order_index ?? 0));

          members.forEach(({ j }) => rendered.add(j));

          const label = String.fromCharCode(65 + order.indexOf(gid));
          rows.push(
            `  - Superset ${label}: ` +
              members
                .map(
                  ({ x }) =>
                    `${x.exercises?.name ?? "Exercise"}${
                      (x.is_dropset ?? (x as any).isDropset) ? " (Dropset)" : ""
                    }`
                )
                .join(" • ")
          );
        } else {
          rows.push(`  - ${name}${isDrop ? " (Dropset)" : ""}`);
        }
      });

      const title = pw.title ?? w?.title ?? "Workout";
      lines.push(`${i + 1}. ${title}\n${rows.join("\n")}`);
    });
    return lines.join("\n");
  }

  function buildGoalsBlock() {
    if (!goals.length) return "No goals set for this plan.";
    return goals
      .map((g) => {
        const start = parseStart(g.notes);
        const mode = labelForMode(g.type);
        const name = g.exercises?.name ?? "Exercise";
        const target = `${g.target_number}${g.unit ? ` ${g.unit}` : ""}`;
        const startTxt = start != null ? ` (start ${start}${g.unit ?? ""})` : "";
        return `• ${name} — ${mode} → ${target}${startTxt}`;
      })
      .join("\n");
  }

  function buildShareText() {
    const title = plan?.title ?? "My Plan";
    const range = `${fmtDate(plan?.start_date)} → ${fmtDate(plan?.end_date)}`;
    const weeks = weeksBetween(plan?.start_date, plan?.end_date);
    const totalPlanned = planWorkouts.length * weeks;
    const left = Math.max(0, totalPlanned - completedCount);

    const deeplink = plan?.id
      ? `\n\nOpen in MuscleMetric: ${Linking.createURL(`/features/plans/view?planId=${plan.id}`)}`
      : "";

    return `🏋️ Plan: ${title}
Dates: ${range} • ${weeks} weeks
Progress: ${completedCount} done • ${left} left • ${totalPlanned} total

Workouts:
${buildWorkoutsBlock()}

Goals:
${buildGoalsBlock()}${deeplink}`;
  }

  async function sharePlan() {
    const message = buildShareText();
    try {
      const smsOk = await SMS.isAvailableAsync();
      if (smsOk) {
        await SMS.sendSMSAsync([], message);
        return;
      }
      await Share.share({ message });
    } catch (e) {
      console.warn("sharePlan error:", e);
    }
  }

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={sharePlan} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
          <Share2 size={22} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, colors.text, plan, planWorkouts, goals, completedCount]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        setLoading(true);

        // 1) Plan
        let p: PlanRow | null = null;
        if (planId) {
          const { data } = await supabase
            .from("plans")
            .select("id, title, start_date, end_date, is_completed")
            .eq("id", planId)
            .maybeSingle();
          p = (data as any) ?? null;
        } else {
          const { data } = await supabase
            .from("plans")
            .select("id, title, start_date, end_date, is_completed")
            .eq("user_id", userId)
            .eq("is_completed", false)
            .order("start_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          p = (data as any) ?? null;
        }
        setPlan(p);

        if (!p?.id) {
          setPlanWorkouts([]);
          setGoals([]);
          setCompletedCount(0);
          return;
        }

        // 2) Plan workouts + workout + exercises
        const { data: pws } = await supabase
          .from("plan_workouts")
          .select(
            `
            id,
            title,
            workouts!inner (
              id,
              title,
              workout_exercises (
                order_index,
                superset_group,
                is_dropset,
                exercises ( name )
              )
            )
          `
          )
          .eq("plan_id", p.id)
          .order("order_index", { ascending: true });

        const rows: PlanWorkoutRow[] = (pws ?? []).map((r: any) => {
          const w = Array.isArray(r.workouts) ? r.workouts[0] : r.workouts;
          return {
            id: String(r.id),
            title: r.title ?? w?.title ?? "Workout",
            workouts: w
              ? {
                  id: String(w.id),
                  title: w.title ?? "Workout",
                  workout_exercises: (w.workout_exercises ?? []).map((we: any) => ({
                    order_index: we?.order_index ?? null,
                    superset_group: we?.superset_group ?? we?.supersetGroup ?? null,
                    is_dropset: we?.is_dropset ?? we?.isDropset ?? null,
                    exercises: we?.exercises ? { name: we.exercises.name ?? null } : null,
                  })),
                }
              : null,
          };
        });

        setPlanWorkouts(rows);

        const workoutIds = rows.map((r) => r.workouts?.id).filter(Boolean) as string[];

        // 3) Completed count (overall, within plan workouts)
        if (workoutIds.length) {
          const { count } = await supabase
            .from("workout_history")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .in("workout_id", workoutIds);
          setCompletedCount(count ?? 0);
        } else {
          setCompletedCount(0);
        }

        // 4) Goals for plan
        const { data: g } = await supabase
          .from("goals")
          .select(
            `
            id,
            type,
            target_number,
            unit,
            deadline,
            notes,
            exercises ( name )
          `
          )
          .eq("plan_id", p.id)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        setGoals((g ?? []) as any);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, planId]);

  if (!userId) {
    return (
      <Screen>
        <ScreenHeader title="Plan" />
        <View style={s.center}>
          <Text style={s.muted}>Please sign in.</Text>
          <View style={{ height: layout.space.md }} />
          <Button title="Go back" variant="outline" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Plan" />
        <View style={s.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen>
        <ScreenHeader title="Plan" />
        <View style={s.center}>
          <Text style={s.muted}>No plan found.</Text>
          <View style={{ height: layout.space.md }} />
          <Button title="Go back" variant="outline" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const planWeeks = weeksBetween(plan.start_date, plan.end_date);
  const totalPlanned = planWorkouts.length * planWeeks;
  const left = Math.max(0, totalPlanned - completedCount);

  return (
    <Screen>
      <ScreenHeader title={plan.title ?? "Plan"} />

      <View style={{ paddingHorizontal: layout.space.md, gap: layout.space.md, paddingBottom: layout.space.xl }}>
        {/* SUMMARY */}
        <Card>
          <View style={{ gap: layout.space.xs }}>
            <Text style={s.title}>{plan.title ?? "My Plan"}</Text>
            <Text style={s.sub}>
              {fmtDate(plan.start_date)} → {fmtDate(plan.end_date)} • {planWeeks} week{planWeeks === 1 ? "" : "s"}
            </Text>

            <View style={s.divider} />

            <View style={{ flexDirection: "row", gap: layout.space.sm, flexWrap: "wrap" }}>
              <Pill label={`${completedCount} done`} tone="neutral" />
              <Pill label={`${left} left`} tone="neutral" />
              <Pill label={`${totalPlanned} total`} tone="neutral" />
            </View>
          </View>
        </Card>

        {/* WORKOUTS */}
        <Card>
          <View style={{ gap: layout.space.sm }}>
            <Text style={s.section}>Workouts</Text>

            {planWorkouts.length === 0 ? (
              <Text style={s.muted}>No workouts in this plan yet.</Text>
            ) : (
              <View style={{ gap: layout.space.sm }}>
                {planWorkouts.map((pw, i) => {
                  const w = pw.workouts;
                  const exs = (w?.workout_exercises ?? [])
                    .slice()
                    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

                  // superset order
                  const groupOrder: string[] = [];
                  const seen = new Set<string>();
                  exs.forEach((e) => {
                    const gid = (e.superset_group ?? e.supersetGroup) || null;
                    if (gid && !seen.has(gid)) {
                      groupOrder.push(gid);
                      seen.add(gid);
                    }
                  });

                  const rendered = new Set<number>();
                  const lines: React.ReactNode[] = [];

                  exs.forEach((e, idx) => {
                    if (rendered.has(idx)) return;
                    const gid = (e.superset_group ?? e.supersetGroup) || null;

                    if (gid) {
                      const members = exs
                        .map((x, j) => ({ x, j }))
                        .filter(({ x }) => (x.superset_group ?? x.supersetGroup) === gid)
                        .sort((a, b) => (a.x.order_index ?? 0) - (b.x.order_index ?? 0));

                      members.forEach(({ j }) => rendered.add(j));

                      const order = groupOrder.indexOf(gid);
                      const groupLabel = String.fromCharCode(65 + order);

                      lines.push(
                        <View key={`ss-${gid}-${i}`} style={s.supersetBlock}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: layout.space.sm }}>
                            <Pill label={`Superset ${groupLabel}`} tone="neutral" />
                          </View>
                          <View style={{ height: layout.space.xs }} />
                          {members.map(({ x, j }) => (
                            <Text key={`ssm-${gid}-${j}`} style={s.rowText}>
                              • {x.exercises?.name ?? "Exercise"}
                              {(x.is_dropset ?? x.isDropset) ? "  · Dropset" : ""}
                            </Text>
                          ))}
                        </View>
                      );
                    } else {
                      lines.push(
                        <Text key={`ex-${i}-${idx}`} style={s.rowText}>
                          • {e.exercises?.name ?? "Exercise"}
                          {(e.is_dropset ?? e.isDropset) ? "  · Dropset" : ""}
                        </Text>
                      );
                    }
                  });

                  return (
                    <View key={w?.id ?? pw.id} style={s.workoutBlock}>
                      <Text style={s.workoutTitle}>
                        {i + 1}. {pw.title ?? w?.title ?? "Workout"}
                      </Text>

                      {lines.length ? (
                        <View style={{ marginTop: layout.space.xs, gap: 4 }}>{lines}</View>
                      ) : (
                        <Text style={s.muted}>No exercises.</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </Card>

        {/* GOALS */}
        <Card>
          <View style={{ gap: layout.space.sm }}>
            <Text style={s.section}>Goals</Text>

            {goals.length === 0 ? (
              <Text style={s.muted}>No goals set for this plan.</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {goals.map((g) => {
                  const start = parseStart(g.notes);
                  const target = `${g.target_number}${g.unit ? ` ${g.unit}` : ""}`;
                  return (
                    <View key={g.id} style={s.goalRow}>
                      <Text style={s.goalTitle}>{g.exercises?.name ?? "Exercise"}</Text>
                      <Text style={s.goalSub}>
                        {labelForMode(g.type)} → {target}
                        {start != null ? `  (start ${start}${g.unit ?? ""})` : ""}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </Card>

        {/* FOOTER */}
        <View style={{ flexDirection: "row", gap: layout.space.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Back" variant="outline" onPress={() => router.back()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Share" variant="primary" onPress={sharePlan} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: layout.space.md,
    },

    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      color: colors.text,
      letterSpacing: -0.2,
    },

    section: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: "uppercase",
    },

    sub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    muted: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: layout.space.sm,
    },

    workoutBlock: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      backgroundColor: colors.card,
    },

    workoutTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },

    rowText: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    supersetBlock: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: layout.radius.lg,
      padding: layout.space.sm,
      backgroundColor: colors.surface,
    },

    goalRow: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      backgroundColor: colors.card,
    },

    goalTitle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
      marginBottom: 2,
    },

    goalSub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },
  });
