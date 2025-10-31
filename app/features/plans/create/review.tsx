// app/_features/plans/create/Review.tsx
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
import { useRootNavigationState, useRouter } from "expo-router";
import { usePlanDraft } from "./store";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/useAuth";
import { useAppTheme } from "../../../../lib/useAppTheme";

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

export default function Review() {
  const { session, loading } = useAuth();
  const userId = session?.user?.id;

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { title, endDate, workoutsPerWeek, workouts, goals, reset } =
    usePlanDraft();

  const goalExerciseIds = useMemo(
    () => new Set(goals.map((g) => g.exercise.id)),
    [goals]
  );

  const [saving, setSaving] = useState(false);
  const [pendingNav, setPendingNav] = useState(false);
  const navState = useRootNavigationState();
  const router = useRouter();

  useEffect(() => {
    if (pendingNav && navState?.key) {
      setPendingNav(false);
      router.replace("/(tabs)");
    }
  }, [pendingNav, navState?.key]);

  const canSave = useMemo(() => {
    if (!title?.trim()) return false;
    if (!endDate) return false;
    if (!workouts || workouts.length !== workoutsPerWeek) return false;
    if (workouts.some((w) => !w.title?.trim() || w.exercises.length === 0))
      return false;
    return true;
  }, [title, endDate, workoutsPerWeek, workouts]);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      Alert.alert("Please log in", "You must be signed in to create a plan.");
      router.replace("/(auth)/login");
    }
  }, [loading, userId]);

  async function handleCreate() {
    if (!userId) return;
    if (!canSave) {
      Alert.alert(
        "Incomplete",
        "Please complete all required fields before creating the plan."
      );
      return;
    }

    try {
      setSaving(true);

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

      const { error } = await supabase.rpc("create_full_plan", {
        p_user_id: userId,
        p_title: title,
        p_end_date: endDate,
        p_workouts,
        p_goals,
      });

      if (error) {
        console.error("create_full_plan RPC failed:", error);
        Alert.alert("Could not create plan", error.message ?? "Unknown error");
        return;
      }

      // ------------------ NEW: set weekly workout goal + init current week ------------------
      const weeklyTarget = Math.max(
        1,
        Math.min(14, Number(workoutsPerWeek) || p_workouts.length || 3)
      );
      const now = new Date();
      const currentWeekKey = weekKeySundayLocal(now); // e.g. "2025-10-26" (the Sunday that starts the week)

      // 1) Store the goal and the "active" week key in profile.settings (no timezone stored)
      await supabase
        .from("profiles")
        .update({
          weekly_workout_goal: weeklyTarget,
          settings: {
            ...((
              await supabase
                .from("profiles")
                .select("settings")
                .eq("id", userId)
                .maybeSingle()
            ).data?.settings ?? {}),
            workout_week_key: currentWeekKey,
          },
        })
        .eq("id", userId);

      // 2) Ensure a row exists for this week in your per-week stats table (create if you don’t have it)
      // Suggest a table: user_weekly_workout_stats(user_id uuid, week_key text, goal int, completed int, met bool, updated_at timestamptz)
      await supabase.from("user_weekly_workout_stats").upsert(
        {
          user_id: userId,
          week_key: currentWeekKey,
          goal: weeklyTarget,
          completed: 0,
          met: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,week_key" }
      );
      // --------------------------------------------------------------------------------------

      Alert.alert("Plan created", "Your plan has been saved.");
      reset();
      setPendingNav(true);
    } catch (e: any) {
      console.error("Unexpected error creating plan:", e);
      Alert.alert("Could not create plan", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  /** Helper: returns the Sunday (local) that starts the week as YYYY-MM-DD */
  function weekKeySundayLocal(d: Date) {
    const copy = new Date(d); // local
    const dow = copy.getDay(); // 0=Sun
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - dow); // back to Sunday
    const y = copy.getFullYear();
    const m = String(copy.getMonth() + 1).padStart(2, "0");
    const day = String(copy.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // the "week_key"
  }

  if (loading || !userId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // keep your fun superset colors (they read well on both themes)
  const SUPERSET_COLORS = [
    "#2563eb",
    "#16a34a",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
  ];
  function colorForGroupId(id: string, order: number) {
    return SUPERSET_COLORS[order % SUPERSET_COLORS.length];
  }
  function groupLabel(order: number) {
    return String.fromCharCode(65 + order);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <View style={styles.card}>
        <Text style={styles.h2}>Review Plan</Text>
        <Text style={styles.muted}>
          Make sure everything looks right before creating your plan.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.h3}>{title || "Untitled Plan"}</Text>
        <Text style={styles.muted}>
          Ends {humanDate(endDate)} • {workoutsPerWeek} workouts/week
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h3}>Workouts</Text>
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

              members.forEach(({ idx }) => rendered.add(`${gid}-${idx}`));
              rendered.add(gid);

              const order = groupsOrder.indexOf(gid);
              const color = colorForGroupId(gid, order);

              rows.push(
                <View
                  key={`group-${gid}`}
                  style={[
                    styles.superset,
                    { borderColor: color, backgroundColor: colors.card },
                  ]}
                >
                  <Text style={{ fontWeight: "800", color, marginBottom: 4 }}>
                    Superset {groupLabel(order)}
                  </Text>

                  {members.map(({ x, idx: memberIdx }) => {
                    const isGoal = goalExerciseIds.has(x.exercise.id);
                    return (
                      <Text
                        key={`m-${gid}-${memberIdx}`}
                        style={[
                          styles.muted,
                          isGoal && {
                            color: colors.primaryText,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        • {x.exercise.name}
                        {x.isDropset ? "  • Dropset" : ""}
                        {isGoal ? "  🎯" : ""}
                      </Text>
                    );
                  })}
                </View>
              );
            } else {
              const isGoal = goalExerciseIds.has(e.exercise.id);
              rows.push(
                <Text
                  key={key}
                  style={[
                    styles.muted,
                    { marginTop: 6 },
                    isGoal && { color: colors.primaryText, fontWeight: "700" },
                  ]}
                >
                  • {e.exercise.name}
                  {e.isDropset ? "  • Dropset" : ""}
                  {isGoal ? "  🎯" : ""}
                </Text>
              );
            }
          });

          return (
            <View key={i} style={styles.subCard}>
              <Text style={styles.h4}>
                {i + 1}. {w.title || "Untitled Workout"}
              </Text>
              {w.exercises.length === 0 ? (
                <Text style={styles.muted}>No exercises yet.</Text>
              ) : (
                <View style={{ marginTop: 4 }}>{rows}</View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.h3}>Goals</Text>
        <View style={{ height: 8 }} />
        {goals.length === 0 ? (
          <Text style={styles.muted}>No goals selected.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {goals.map((g, i) => (
              <Text
                key={i}
                style={[
                  styles.muted,
                  { color: colors.primaryText, fontWeight: "700" },
                ]}
              >
                • {g.exercise.name} — {g.mode.replace("_", " ")} → {g.target}
                {g.unit ? ` ${g.unit}` : ""}
                {g.start != null ? `  (start ${g.start}${g.unit ?? ""})` : ""}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>← Back</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.primary, { flex: 1 }]}
          onPress={handleCreate}
          disabled={!canSave || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primary ?? "#fff"} />
          ) : (
            <Text
              style={[
                styles.btnText,
                { color: colors.primary ?? "#fff", fontWeight: "800" },
              ]}
            >
              Create Plan
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
    },

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
  });
