import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlanDraft } from "./store";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";

import PaywallModal from "@/app/features/paywall/components/PaywallModal";
import { Icon } from "@/ui";

import { log } from "@/lib/logger";

function humanDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso as string;
  }
}

function weekKeySundayLocal(d: Date) {
  const copy = new Date(d);
  const dow = copy.getDay();
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - dow);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type PaywallReason = "goal_limit" | "plan_limit";

function isGoalLimitError(err: any) {
  const code = String(err?.code ?? "").toUpperCase();
  const message = String(err?.message ?? "").toLowerCase();
  const details = String(err?.details ?? "").toLowerCase();

  return (
    code === "FREE_LIMIT_REACHED" ||
    code === "PREMIUM_REQUIRED" ||
    (message.includes("goal") && message.includes("limit")) ||
    (details.includes("goal") && details.includes("limit")) ||
    message.includes("maxgoalsperplan") ||
    details.includes("maxgoalsperplan")
  );
}

function isPlanLimitError(err: any) {
  const code = String(err?.code ?? "").toUpperCase();
  const message = String(err?.message ?? "").toLowerCase();
  const details = String(err?.details ?? "").toLowerCase();

  return (
    code === "FREE_LIMIT_REACHED" ||
    code === "PREMIUM_REQUIRED" ||
    (message.includes("plan") && message.includes("limit")) ||
    (details.includes("plan") && details.includes("limit")) ||
    message.includes("maxactiveplans") ||
    details.includes("maxactiveplans") ||
    message.includes("active plan") ||
    details.includes("active plan")
  );
}

export default function Review() {
  const { session, loading, capabilities } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, typography, layout } = useAppTheme();
  const s = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout],
  );

  const { title, endDate, workoutsPerWeek, workouts, goals } = usePlanDraft();

  const goalExerciseIds = useMemo(
    () => new Set(goals.map((g) => g.exercise.id)),
    [goals],
  );

  const [saving, setSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason>("goal_limit");

  const router = useRouter();

  const goalsValid = useMemo(() => {
    if (goals.length < 1 || goals.length > capabilities.maxGoalsPerPlan) {
      return false;
    }

    return goals.every(
      (g) =>
        g.start != null &&
        !Number.isNaN(g.start) &&
        g.start > 0 &&
        g.target != null &&
        !Number.isNaN(g.target) &&
        g.target > 0,
    );
  }, [goals, capabilities.maxGoalsPerPlan]);

  const canSave = useMemo(() => {
    if (!title?.trim()) return false;
    if (!endDate) return false;
    if (!workouts || workouts.length !== workoutsPerWeek) return false;
    if (workouts.some((w) => !w.title?.trim() || w.exercises.length === 0)) {
      return false;
    }
    if (!goalsValid) return false;
    return true;
  }, [title, endDate, workoutsPerWeek, workouts, goalsValid]);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      Alert.alert("Please log in", "You must be signed in to create a plan.");
      router.replace("/(auth)/login");
    }
  }, [loading, userId, router]);

  async function handleCreate() {
    if (!userId) return;

    if (!canSave) {
      Alert.alert(
        "Incomplete",
        "Please complete all required fields and goals before creating the plan.",
      );
      return;
    }

    try {
      setSaving(true);
      setSaveErrorMessage(null);

      const p_workouts = workouts.map((w) => ({
        title: w.title,
        exercises: w.exercises.map((e) => ({
          exerciseId: e.exercise.id,
          order_index: e.order_index,
          supersetGroup: e.supersetGroup ?? null,
          isDropset: !!e.isDropset,
          target_sets: e.target_sets ?? null,
          target_reps: e.target_reps ?? null,
          target_weight: e.target_weight ?? null,
          target_time_seconds: e.target_time_seconds ?? null,
          target_distance: e.target_distance ?? null,
          notes: e.notes ?? null,
        })),
      }));

      const p_goals = goals.map((g) => ({
        exerciseId: g.exercise.id,
        mode: g.mode,
        target: g.target,
        unit: g.unit ?? null,
        start: g.start ?? null,
      }));

      const { error: rpcError } = await supabase.rpc("create_plan_v1", {
        p_user_id: userId,
        p_title: title,
        p_end_date: endDate,
        p_workouts,
        p_goals,
      });

      if (rpcError) {
        console.error("create_plan_v1 RPC failed:", rpcError);

        if (isGoalLimitError(rpcError)) {
          setPaywallReason("goal_limit");
          setSaveErrorMessage(
            `This plan has too many goals for your current limit. You can save up to ${
              capabilities.maxGoalsPerPlan
            } goal${capabilities.maxGoalsPerPlan === 1 ? "" : "s"} per plan on your current tier.`,
          );
          return;
        }

        if (isPlanLimitError(rpcError)) {
          setPaywallReason("plan_limit");
          setSaveErrorMessage(
            `You’ve reached your active plan limit. Upgrade to MuscleMetric Pro to create more active plans.`,
          );
          return;
        }

        Alert.alert(
          "Could not create plan",
          rpcError.message ?? "Unknown error",
        );
        return;
      }

      const weeklyTarget = Math.max(
        1,
        Math.min(14, Number(workoutsPerWeek) || p_workouts.length || 3),
      );
      const currentWeekKey = weekKeySundayLocal(new Date());

      const { data: profileRow, error: profileSelectErr } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", userId)
        .maybeSingle();

      if (profileSelectErr) {
        console.warn("Failed to load profile settings:", profileSelectErr);
      }

      const existingSettings =
        (profileRow?.settings as Record<string, any> | null) ?? {};

      const { error: profileUpdateErr } = await supabase
        .from("profiles")
        .update({
          weekly_workout_goal: weeklyTarget,
          settings: {
            ...existingSettings,
            workout_week_key: currentWeekKey,
          },
        })
        .eq("id", userId);

      if (profileUpdateErr) {
        console.warn("Failed to update profile weekly goal:", profileUpdateErr);
      }

      const { error: weeklyErr } = await supabase
        .from("user_weekly_workout_stats")
        .upsert(
          {
            user_id: userId,
            week_key: currentWeekKey,
            goal: weeklyTarget,
            completed: 0,
            met: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,week_key" },
        );

      if (weeklyErr) {
        console.warn("Failed to upsert weekly workout stats:", weeklyErr);
      }

      Alert.alert("Plan created", "Your plan has been saved.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/workout") },
      ]);
    } catch (e: any) {
      console.error("Unexpected error creating plan:", e);

      if (isGoalLimitError(e)) {
        setPaywallReason("goal_limit");
        setSaveErrorMessage(
          `This plan has too many goals for your current limit. You can save up to ${
            capabilities.maxGoalsPerPlan
          } goal${capabilities.maxGoalsPerPlan === 1 ? "" : "s"} per plan on your current tier.`,
        );
        return;
      }

      if (isPlanLimitError(e)) {
        setPaywallReason("plan_limit");
        setSaveErrorMessage(
          "You’ve reached your active plan limit. Upgrade to MuscleMetric Pro to create more active plans.",
        );
        return;
      }

      Alert.alert("Could not create plan", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  const blocked = loading || !userId;

  const SUPERSET_COLORS = [
    colors.primary,
    "#16a34a",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
  ];

  function colorForGroupId(order: number) {
    return SUPERSET_COLORS[order % SUPERSET_COLORS.length];
  }

  function groupLabel(order: number) {
    return String.fromCharCode(65 + order);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: layout.space.lg, gap: layout.space.md }}
      >
        <View style={s.card}>
          <Text style={s.h2}>Review Plan</Text>
          <Text style={s.muted}>
            Make sure everything looks right before creating your plan.
          </Text>

          <View style={s.divider} />

          <Text style={s.h3}>{title || "Untitled Plan"}</Text>
          <Text style={s.muted}>
            Ends {humanDate(endDate)} • {workoutsPerWeek} workouts/week
          </Text>
        </View>

        {saveErrorMessage ? (
          <View style={s.limitCard}>
            <View style={s.limitHeader}>
              <Icon name="lock-closed" size={18} color={colors.primary} />
              <Text style={s.limitTitle}>Upgrade required</Text>
            </View>

            <Text style={s.limitBody}>{saveErrorMessage}</Text>

            <Pressable
              style={s.limitButton}
              onPress={() => setPaywallOpen(true)}
            >
              <Text style={s.limitButtonText}>
                {paywallReason === "plan_limit"
                  ? "Unlock more plans"
                  : "Unlock more goals"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.card}>
          <Text style={s.h3}>Workouts</Text>
          <View style={{ height: 8 }} />

          {workouts.map((w, i) => {
            const groupsOrder: string[] = [];
            const seen = new Set<string>();

            w.exercises.forEach((ex) => {
              if (ex.supersetGroup && !seen.has(ex.supersetGroup)) {
                groupsOrder.push(ex.supersetGroup);
                seen.add(ex.supersetGroup);
              }
            });

            const rendered = new Set<string>();
            const rows: React.ReactNode[] = [];

            w.exercises.forEach((e, j) => {
              const key = `${e.exercise.id}-${j}`;

              if (e.supersetGroup) {
                const gid = e.supersetGroup;
                if (rendered.has(gid)) return;

                const members = w.exercises
                  .map((x, idx) => ({ x, idx }))
                  .filter(({ x }) => x.supersetGroup === gid);

                rendered.add(gid);

                const order = groupsOrder.indexOf(gid);
                const color = colorForGroupId(order);

                rows.push(
                  <View
                    key={`group-${gid}`}
                    style={[s.superset, { borderColor: color }]}
                  >
                    <Text style={[s.supersetTitle, { color }]}>
                      Superset {groupLabel(order)}
                    </Text>

                    {members.map(({ x, idx: memberIdx }) => {
                      const isGoal = goalExerciseIds.has(x.exercise.id);
                      return (
                        <Text
                          key={`m-${gid}-${memberIdx}`}
                          style={[s.line, isGoal && s.lineGoal]}
                        >
                          • {x.exercise.name}
                          {x.isDropset ? "  • Dropset" : ""}
                          {isGoal ? "  🎯" : ""}
                        </Text>
                      );
                    })}
                  </View>,
                );
              } else {
                const isGoal = goalExerciseIds.has(e.exercise.id);
                rows.push(
                  <Text
                    key={key}
                    style={[s.line, { marginTop: 6 }, isGoal && s.lineGoal]}
                  >
                    • {e.exercise.name}
                    {e.isDropset ? "  • Dropset" : ""}
                    {isGoal ? "  🎯" : ""}
                  </Text>,
                );
              }
            });

            return (
              <View key={i} style={s.subCard}>
                <Text style={s.h4}>
                  {i + 1}. {w.title || "Untitled Workout"}
                </Text>
                {w.exercises.length === 0 ? (
                  <Text style={s.muted}>No exercises yet.</Text>
                ) : (
                  <View>{rows}</View>
                )}
              </View>
            );
          })}
        </View>

        <View style={s.card}>
          <Text style={s.h3}>Goals</Text>
          <View style={{ height: 8 }} />
          {goals.length === 0 ? (
            <Text style={s.muted}>No goals selected.</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {goals.map((g, i) => (
                <Text key={i} style={[s.line, s.lineGoal]}>
                  • {g.exercise.name} — {g.mode.replaceAll("_", " ")} → {g.target}
                  {g.unit ? ` ${g.unit}` : ""}
                  {g.start != null ? `  (start ${g.start}${g.unit ?? ""})` : ""}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable style={s.btn} onPress={() => router.back()}>
            <Text style={s.btnText}>← Back</Text>
          </Pressable>

          <Pressable
            style={[
              s.btn,
              s.primary,
              { flex: 1, opacity: blocked || !canSave || saving ? 0.6 : 1 },
            ]}
            onPress={handleCreate}
            disabled={blocked || !canSave || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary ?? "#fff"} />
            ) : (
              <Text style={[s.btnText, { color: colors.onPrimary ?? "#fff" }]}>
                Create Plan
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <PaywallModal
        visible={paywallOpen}
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
        onStartTrial={() => {
          log(`[Paywall] Start trial tapped: ${paywallReason}`);
          setPaywallOpen(false);
        }}
        onRestorePurchases={() => {
          log("[Paywall] Restore purchases tapped");
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: layout.radius.xl,
      padding: layout.space.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subCard: {
      backgroundColor: colors.bg,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 4,
      marginBottom: layout.space.sm,
    },

    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: layout.space.md,
    },

    h2: {
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
    },
    h3: {
      fontSize: typography.size.h3,
      lineHeight: typography.lineHeight.h3,
      fontFamily: typography.fontFamily.bold,
      color: colors.text,
    },
    h4: {
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      fontFamily: typography.fontFamily.semibold,
      color: colors.text,
    },
    muted: {
      marginTop: 2,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },

    line: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },
    lineGoal: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
    },

    superset: {
      borderWidth: 2,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      marginTop: layout.space.sm,
      backgroundColor: colors.trackBg,
      gap: 2,
    },
    supersetTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 4,
    },

    limitCard: {
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: layout.space.sm,
    },
    limitHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    limitTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
    },
    limitBody: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta + 2,
    },
    limitButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.primary,
    },
    limitButtonText: {
      color: colors.onPrimary,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
    },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 12,
      borderRadius: layout.radius.lg,
      alignItems: "center",
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
      color: colors.text,
    },
    primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });