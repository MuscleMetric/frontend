// app/features/plans/view.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../lib/authContext";
import { supabase } from "../../../lib/supabase";
import { useAppTheme } from "../../../lib/useAppTheme";
// at top with other imports
import { Share, Platform } from "react-native";
import * as SMS from "expo-sms";
import * as Linking from "expo-linking";
import { useNavigation } from "expo-router";
import { Share2 } from "lucide-react-native";

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
    superset_group?: string | null; // db snake_case
    supersetGroup?: string | null; // fallback camelCase (if your table differs)
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
  notes: string | null; // { start?: number }
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [planWorkouts, setPlanWorkouts] = useState<PlanWorkoutRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={sharePlan}
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
        >
          <Share2 size={22} color={colors.text} />
        </Pressable>
      ),
    });
    // include deps that change the text content so header button can access latest data
  }, [navigation, colors.text, plan, planWorkouts, goals, completedCount]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        setLoading(true);

        // 1) Plan (by id; if missing, fall back to active)
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

        // 2) Plan workouts with nested workout + exercises
        let workoutIds: string[] = [];
        if (p?.id) {
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
                    workout_exercises: (w.workout_exercises ?? []).map(
                      (we: any) => ({
                        order_index: we?.order_index ?? null,
                        superset_group:
                          we?.superset_group ?? we?.supersetGroup ?? null,
                        is_dropset: we?.is_dropset ?? we?.isDropset ?? null,
                        exercises: we?.exercises
                          ? { name: we.exercises.name ?? null }
                          : null,
                      })
                    ),
                  }
                : null,
            };
          });

          setPlanWorkouts(rows);
          workoutIds = rows
            .map((r) => r.workouts?.id)
            .filter(Boolean) as string[];

          // 3) Completed count for these workouts
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

          // 4) Goals for this plan
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
        } else {
          setPlanWorkouts([]);
          setGoals([]);
          setCompletedCount(0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, planId]);

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

      // render groups/rows
      const rendered = new Set<number>();
      const rows: string[] = [];
      exs.forEach((e, idx) => {
        if (rendered.has(idx)) return;
        const gid = (e.superset_group ?? (e as any).supersetGroup) || null;
        const name = e.exercises?.name ?? "Exercise";
        const dropset =
          e.is_dropset ?? (e as any).isDropset ? " • Dropset" : "";

        if (gid) {
          const members = exs
            .map((x, j) => ({ x, j }))
            .filter(
              ({ x }) => (x.superset_group ?? (x as any).supersetGroup) === gid
            )
            .sort((a, b) => (a.x.order_index ?? 0) - (b.x.order_index ?? 0));
          members.forEach(({ j }) => rendered.add(j));
          const label = String.fromCharCode(65 + order.indexOf(gid));
          rows.push(
            `  - Superset ${label}: ` +
              members
                .map(
                  ({ x }) =>
                    `${x.exercises?.name ?? "Exercise"}${
                      x.is_dropset ?? (x as any).isDropset ? " (Dropset)" : ""
                    }`
                )
                .join(" • ")
          );
        } else {
          rows.push(`  - ${name}${dropset ? " (Dropset)" : ""}`);
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
        const startTxt =
          start != null ? ` (start ${start}${g.unit ?? ""})` : "";
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

    // optional deep link back to your app (works if you’ve configured a scheme)
    const deeplink = plan?.id
      ? `\n\nOpen in MuscleMetric: ${Linking.createURL(
          `/features/plans/view?planId=${plan.id}`
        )}`
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
      // Prefer SMS for “send via text message”
      const smsOk = await SMS.isAvailableAsync();
      if (smsOk) {
        // Empty recipients array -> user picks contact; body is prefilled
        await SMS.sendSMSAsync([], message);
        return;
      }

      // Fallback to platform share sheet
      await Share.share({ message });
    } catch (e) {
      // optional: show a gentle alert/toast if sharing fails
      console.warn("sharePlan error:", e);
    }
  }

  if (!userId) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Please sign in.</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!plan) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>No plan found.</Text>
        <Pressable
          style={[s.btn, s.primary, { marginTop: 12 }]}
          onPress={() => router.back()}
        >
          <Text style={s.btnPrimaryText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const planWeeks = weeksBetween(plan.start_date, plan.end_date);
  const totalPlanned = planWorkouts.length * planWeeks;
  const left = Math.max(0, totalPlanned - completedCount);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      {/* Header card */}
      <View style={s.card}>
        <Text style={s.h2}>{plan.title ?? "My Plan"}</Text>
        <Text style={s.muted}>
          {fmtDate(plan.start_date)} → {fmtDate(plan.end_date)} • {planWeeks}{" "}
          weeks
        </Text>
        <View style={s.divider} />
        <Text style={s.h3}>Progress</Text>
        <Text style={s.muted}>
          {completedCount} completed • {left} left • {totalPlanned} total
        </Text>
      </View>

      {/* Workouts list */}
      <View style={s.card}>
        <Text style={s.h3}>Workouts</Text>
        <View style={{ height: 8 }} />
        {planWorkouts.length === 0 ? (
          <Text style={s.muted}>No workouts in this plan yet.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {planWorkouts.map((pw, i) => {
              const w = pw.workouts;
              const exs = w?.workout_exercises ?? [];

              // Gather superset groups in order
              const groupOrder: string[] = [];
              const seen = new Set<string>();
              exs.forEach((e) => {
                const gid = (e.superset_group ?? e.supersetGroup) || null;
                if (gid && !seen.has(gid)) {
                  groupOrder.push(gid);
                  seen.add(gid);
                }
              });

              // Render pass: group supersets together
              const rendered = new Set<number>();
              const rows: React.ReactNode[] = [];

              exs
                .slice()
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .forEach((e, idx) => {
                  if (rendered.has(idx)) return;
                  const gid = (e.superset_group ?? e.supersetGroup) || null;

                  if (gid) {
                    // collect members for this group in order
                    const members = exs
                      .map((x, j) => ({ x, j }))
                      .filter(
                        ({ x }) => (x.superset_group ?? x.supersetGroup) === gid
                      )
                      .sort(
                        (a, b) =>
                          (a.x.order_index ?? 0) - (b.x.order_index ?? 0)
                      );

                    members.forEach(({ j }) => rendered.add(j));
                    const order = groupOrder.indexOf(gid);
                    const groupLabel = String.fromCharCode(65 + order);

                    rows.push(
                      <View
                        key={`g-${gid}-${i}-${order}`}
                        style={[s.superset, { borderColor: colors.primary }]}
                      >
                        <Text
                          style={[s.supersetTitle, { color: colors.primary }]}
                        >
                          Superset {groupLabel}
                        </Text>
                        {members.map(({ x, j }) => (
                          <Text key={`m-${gid}-${j}`} style={s.muted}>
                            • {x.exercises?.name ?? "Exercise"}
                            {x.is_dropset ?? x.isDropset ? "  • Dropset" : ""}
                          </Text>
                        ))}
                      </View>
                    );
                  } else {
                    rows.push(
                      <Text
                        key={`e-${idx}`}
                        style={[s.muted, { marginTop: 4 }]}
                      >
                        • {e.exercises?.name ?? "Exercise"}
                        {e.is_dropset ?? e.isDropset ? "  • Dropset" : ""}
                      </Text>
                    );
                  }
                });

              return (
                <View key={w?.id ?? i} style={s.subCard}>
                  <Text style={s.h4}>
                    {i + 1}. {pw.title ?? w?.title ?? "Workout"}
                  </Text>
                  {rows.length ? (
                    <View style={{ marginTop: 4 }}>{rows}</View>
                  ) : (
                    <Text style={s.muted}>No exercises.</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Goals */}
      <View style={s.card}>
        <Text style={s.h3}>Goals</Text>
        <View style={{ height: 8 }} />
        {goals.length === 0 ? (
          <Text style={s.muted}>No goals set for this plan.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {goals.map((g) => {
              const start = parseStart(g.notes);
              return (
                <Text
                  key={g.id}
                  style={[
                    s.muted,
                    { color: colors.primaryText, fontWeight: "700" },
                  ]}
                >
                  • {g.exercises?.name ?? "Exercise"} — {labelForMode(g.type)} →{" "}
                  {g.target_number}
                  {g.unit ? ` ${g.unit}` : ""}
                  {start != null ? `  (start ${start}${g.unit ?? ""})` : ""}
                </Text>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable style={s.btn} onPress={() => router.back()}>
          <Text style={s.btnText}>← Back</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
    h2: { fontSize: 18, fontWeight: "800", color: colors.text },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    h4: { fontSize: 14, fontWeight: "700", color: colors.text },
    muted: { color: colors.subtle },
    superset: {
      borderWidth: 2,
      borderRadius: 12,
      padding: 10,
      marginTop: 6,
      backgroundColor: colors.card,
    },
    supersetTitle: { fontWeight: "800", marginBottom: 4 },
    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: { fontWeight: "700", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "800" },
  });
