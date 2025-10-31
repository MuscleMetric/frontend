// app/(features)/goals/goals.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";
import { useAppTheme } from "../../../lib/useAppTheme";

/* ---------- types ---------- */

type Plan = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean | null;
};

type GoalRow = {
  id: string;
  type: "exercise_weight" | "exercise_reps" | "distance" | "time";
  target_number: number;
  unit: string | null;
  deadline: string | null;
  is_active: boolean | null;
  notes: string | null; // JSON with { start?: number }
  exercises: { name: string | null } | null;
};

function weekKeySundayLocal(d: Date) {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0=Sun
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - dow);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ---------- component ---------- */

export default function GoalsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);

  // steps goal state
  const [stepsLoading, setStepsLoading] = useState(true);
  const [stepsGoal, setStepsGoal] = useState<number>(10000);
  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsDraft, setStepsDraft] = useState<string>("10000");
  const [savingSteps, setSavingSteps] = useState(false);

  // weekly workout goal state
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(1);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [weeklyDraft, setWeeklyDraft] = useState<string>("3");
  const [savingWeekly, setSavingWeekly] = useState(false);

  /* ----- load steps goal ----- */
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        setStepsLoading(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("steps_goal")
          .eq("id", userId)
          .maybeSingle();
        const goal =
          !error && data?.steps_goal != null ? Number(data.steps_goal) : 10000;
        if (alive) {
          const safe = Math.max(0, Math.min(50000, Math.round(goal)));
          setStepsGoal(safe);
          setStepsDraft(String(safe));
        }
      } finally {
        if (alive) setStepsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  async function saveStepsGoal() {
    if (!userId) return;
    const n = Math.max(0, Math.min(50000, Math.round(Number(stepsDraft) || 0)));
    try {
      setSavingSteps(true);
      const { error } = await supabase
        .from("profiles")
        .update({ steps_goal: n })
        .eq("id", userId);
      if (error) throw error;
      setStepsGoal(n);
      setEditingSteps(false);
    } catch (e: any) {
      Alert.alert("Could not save steps goal", e?.message ?? "Unknown error");
    } finally {
      setSavingSteps(false);
    }
  }

  /* ----- load plan + goals ----- */
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);

        // 1) Active plan (else most recent)
        let { data: activePlan } = await supabase
          .from("plans")
          .select("id, title, start_date, end_date, is_completed")
          .eq("user_id", userId)
          .eq("is_completed", false)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!activePlan) {
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

        // 2) Goals for that plan (if any)
        if (activePlan?.id) {
          const { data: g } = await supabase
            .from("goals")
            .select(
              `
              id,
              type,
              target_number,
              unit,
              deadline,
              is_active,
              notes,
              exercises ( name )
            `
            )
            .eq("plan_id", activePlan.id)
            .eq("user_id", userId)
            .order("created_at", { ascending: true });

          const rows: GoalRow[] = (g ?? []).map((r: any) => {
            let ex: { name: string | null } | null = null;
            if (Array.isArray(r.exercises)) {
              const first = r.exercises[0];
              ex = first ? { name: first?.name ?? null } : null;
            } else if (r.exercises) {
              ex = { name: r.exercises?.name ?? null };
            }

            return {
              id: String(r.id),
              type: r.type,
              target_number: Number(r.target_number),
              unit: r.unit ?? null,
              deadline: r.deadline ?? null,
              is_active: Boolean(r.is_active),
              notes: r.notes ?? null,
              exercises: ex,
            };
          });

          setGoals(rows);
        } else {
          setGoals([]);
        }
      } catch (e) {
        console.warn("goals load error:", e);
        if (!cancelled) {
          setPlan(null);
          setGoals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const planTitle = plan?.title ?? "Active Plan";
  const endText = useMemo(() => {
    if (!plan?.end_date) return null;
    const d = new Date(plan.end_date);
    return isNaN(d.getTime())
      ? plan.end_date
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  }, [plan?.end_date]);

  function fmtMode(m: GoalRow["type"]) {
    switch (m) {
      case "exercise_weight":
        return "Weight";
      case "exercise_reps":
        return "Reps";
      case "distance":
        return "Distance";
      case "time":
        return "Time";
      default:
        return m;
    }
  }

  function parseStart(notes?: string | null): number | null {
    if (!notes) return null;
    try {
      const obj = JSON.parse(notes);
      if (typeof obj?.start === "number") return obj.start;
      return null;
    } catch {
      return null;
    }
  }

  /* ----- load weekly goal ----- */
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        setWeeklyLoading(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("weekly_workout_goal")
          .eq("id", userId)
          .maybeSingle();
        const goal =
          !error && data?.weekly_workout_goal != null
            ? Number(data.weekly_workout_goal)
            : 3;
        if (alive) {
          const safe = Math.max(1, Math.min(14, Math.round(goal)));
          setWeeklyGoal(safe);
          setWeeklyDraft(String(safe));
        }
      } finally {
        if (alive) setWeeklyLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  async function saveWeeklyGoal() {
    if (!userId) return;
    const n = Math.max(1, Math.min(14, Math.round(Number(weeklyDraft) || 0)));
    try {
      setSavingWeekly(true);

      // 1) Save to profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ weekly_workout_goal: n })
        .eq("id", userId);
      if (profErr) throw profErr;

      // 2) Sync the *current week* row
      const nowKey = weekKeySundayLocal(new Date());

      // read existing completed (if any)
      const { data: existing, error: readErr } = await supabase
        .from("user_weekly_workout_stats")
        .select("completed")
        .eq("user_id", userId)
        .eq("week_key", nowKey)
        .maybeSingle();
      if (readErr) throw readErr;

      const completed = Number(existing?.completed ?? 0);
      const met = completed >= n;

      // upsert current week with new goal
      const { error: upsertErr } = await supabase
        .from("user_weekly_workout_stats")
        .upsert(
          {
            user_id: userId,
            week_key: nowKey,
            goal: n,
            completed,
            met,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,week_key" }
        );
      if (upsertErr) throw upsertErr;

      setWeeklyGoal(n);
      setEditingWeekly(false);
    } catch (e: any) {
      Alert.alert("Could not save weekly goal", e?.message ?? "Unknown error");
    } finally {
      setSavingWeekly(false);
    }
  }

  /* ---------- render ---------- */

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Goals</Text>
          <Text style={styles.h2}>
            {plan
              ? `From “${planTitle}”${endText ? ` • Ends ${endText}` : ""}`
              : "No active plan"}
          </Text>
        </View>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingVertical: 16 }}
      >
        {/* Weekly Workout Goal card */}
        <View style={styles.card}>
          <Text style={styles.h3}>Weekly Workout Goal</Text>

          {weeklyLoading ? (
            <ActivityIndicator style={{ marginTop: 6 }} />
          ) : !editingWeekly ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 6,
              }}
            >
              <Text style={styles.big}>{weeklyGoal} workouts/week</Text>
              {!plan ? (
                <Pressable
                  style={[styles.btn, styles.primary]}
                  onPress={() => setEditingWeekly(true)}
                >
                  <Text style={styles.btnPrimaryText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={weeklyDraft}
                onChangeText={setWeeklyDraft}
                keyboardType="number-pad"
                placeholder="e.g. 3"
                placeholderTextColor={colors.subtle}
              />
              <Pressable
                style={[
                  styles.btn,
                  styles.primary,
                  { opacity: savingWeekly ? 0.7 : 1 },
                ]}
                disabled={savingWeekly}
                onPress={saveWeeklyGoal}
              >
                <Text style={styles.btnPrimaryText}>
                  {savingWeekly ? "Saving…" : "Save"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.btn}
                onPress={() => {
                  setWeeklyDraft(String(weeklyGoal));
                  setEditingWeekly(false);
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
            </View>
          )}
          <Text style={[styles.subtle, { marginTop: 6 }]}>
            This goal determines your weekly progress streak.
          </Text>
        </View>

        {/* Steps Goal card */}
        <View style={styles.card}>
          <Text style={styles.h3}>Daily Steps Goal</Text>

          {stepsLoading ? (
            <ActivityIndicator style={{ marginTop: 6 }} />
          ) : !editingSteps ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 6,
              }}
            >
              <Text style={styles.big}>{stepsGoal.toLocaleString()} steps</Text>
              <Pressable
                style={[styles.btn, styles.primary]}
                onPress={() => setEditingSteps(true)}
              >
                <Text style={styles.btnPrimaryText}>Edit</Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={stepsDraft}
                onChangeText={setStepsDraft}
                keyboardType="number-pad"
                placeholder="e.g. 10000"
                placeholderTextColor={colors.subtle}
              />
              <Pressable
                style={[
                  styles.btn,
                  styles.primary,
                  { opacity: savingSteps ? 0.7 : 1 },
                ]}
                disabled={savingSteps}
                onPress={saveStepsGoal}
              >
                <Text style={styles.btnPrimaryText}>
                  {savingSteps ? "Saving…" : "Save"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.btn}
                onPress={() => {
                  setStepsDraft(String(stepsGoal));
                  setEditingSteps(false);
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
            </View>
          )}
          <Text style={[styles.subtle, { marginTop: 6 }]}>
            This goal powers your daily summary and streaks.
          </Text>
        </View>

        {/* Plan Goals card(s) */}
        <View style={styles.card}>
          <Text style={styles.h3}>Plan Goals</Text>
          <View style={{ height: 8 }} />

          {loading ? (
            <ActivityIndicator />
          ) : goals.length === 0 ? (
            <>
              <Text style={styles.subtle}>
                No plan goals yet. Once you create a plan with goals, they will
                appear here.
              </Text>
              <Pressable
                style={[styles.btn, styles.primary, { marginTop: 12 }]}
                onPress={() => router.push("/features/plans/create/planInfo")}
              >
                <Text style={styles.btnPrimaryText}>Create Plan</Text>
              </Pressable>
            </>
          ) : (
            <View style={{ gap: 12 }}>
              {goals.map((g) => {
                const start = parseStart(g.notes);
                const exerciseName = g.exercises?.name ?? "Exercise";
                return (
                  <View key={g.id} style={styles.goalRow}>
                    <Text style={styles.title}>{exerciseName}</Text>
                    <Text style={styles.subtle}>
                      {fmtMode(g.type)} → {g.target_number}
                      {g.unit ? ` ${g.unit}` : ""}
                      {start != null ? `  (start ${start}${g.unit ?? ""})` : ""}
                    </Text>
                    {!!g.deadline && (
                      <Text style={styles.deadline}>
                        Due{" "}
                        {new Date(g.deadline).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    link: { color: colors.primaryText, fontWeight: "700", width: 52 },
    headerRow: {
      paddingBottom: 8,
      paddingTop: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    h1: { fontSize: 18, fontWeight: "800", color: colors.text },
    h2: { color: colors.subtle },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    big: { fontSize: 20, fontWeight: "800", color: colors.text },

    body: { flex: 1, paddingVertical: 16 },

    subtle: { color: colors.subtle },
    title: { fontWeight: "800", color: colors.text },
    deadline: { color: colors.subtle, marginTop: 4 },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    goalRow: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    input: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: { fontWeight: "800", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { fontWeight: "800", color: colors.onPrimary ?? "#fff" },
  });
