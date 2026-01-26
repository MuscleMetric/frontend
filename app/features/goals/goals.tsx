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
import { useAuth } from "../../../lib/authContext";
import { useAppTheme } from "../../../lib/useAppTheme";

import PlanGoalsCard from "./components/PlansGoalsCard";

/* ---------- helpers ---------- */
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

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/* ---------- component ---------- */
export default function GoalsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  // steps goal state
  const [stepsLoading, setStepsLoading] = useState(true);
  const [stepsGoal, setStepsGoal] = useState<number>(10000);
  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsDraft, setStepsDraft] = useState<string>("10000");
  const [savingSteps, setSavingSteps] = useState(false);

  // weekly workout goal state
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(3);
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

        if (!alive) return;
        const safe = clampInt(goal, 0, 50000);
        setStepsGoal(safe);
        setStepsDraft(String(safe));
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
    const n = clampInt(Number(stepsDraft) || 0, 0, 50000);
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

        if (!alive) return;
        const safe = clampInt(goal, 1, 14);
        setWeeklyGoal(safe);
        setWeeklyDraft(String(safe));
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
    const n = clampInt(Number(weeklyDraft) || 0, 1, 14);

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

      const { data: existing, error: readErr } = await supabase
        .from("user_weekly_workout_stats")
        .select("completed")
        .eq("user_id", userId)
        .eq("week_key", nowKey)
        .maybeSingle();
      if (readErr) throw readErr;

      const completed = Number(existing?.completed ?? 0);
      const met = completed >= n;

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

  const Header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={styles.title}>Goals</Text>
      </View>

      {/* Right spacer to keep title centered */}
      <View style={styles.backBtn} />
    </View>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {Header}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly Workout Goal */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Weekly</Text>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle}>Workout Goal</Text>
            {!weeklyLoading && !editingWeekly && (
              <Pressable
                style={[styles.pillBtn, { borderColor: colors.border }]}
                onPress={() => setEditingWeekly(true)}
              >
                <Text style={styles.pillBtnText}>Edit</Text>
              </Pressable>
            )}
          </View>

          {weeklyLoading ? (
            <ActivityIndicator style={{ marginTop: 10 }} />
          ) : !editingWeekly ? (
            <>
              <Text style={styles.bigValue}>{weeklyGoal}</Text>
              <Text style={styles.bigSuffix}>workouts / week</Text>
              <Text style={styles.helper}>
                This goal drives your weekly streak and progress ring.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.editRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={weeklyDraft}
                  onChangeText={setWeeklyDraft}
                  keyboardType="number-pad"
                  placeholder="e.g. 3"
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable
                  style={[
                    styles.primaryBtn,
                    { opacity: savingWeekly ? 0.7 : 1 },
                  ]}
                  disabled={savingWeekly}
                  onPress={saveWeeklyGoal}
                >
                  <Text style={styles.primaryBtnText}>
                    {savingWeekly ? "Saving…" : "Save"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.ghostBtn}
                onPress={() => {
                  setWeeklyDraft(String(weeklyGoal));
                  setEditingWeekly(false);
                }}
              >
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </Pressable>

              <Text style={styles.helper}>
                Pick 1–14. Keep it realistic so you can actually hit streaks.
              </Text>
            </>
          )}
        </View>

        {/* Steps Goal */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Daily</Text>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle}>Steps Goal</Text>
            {!stepsLoading && !editingSteps && (
              <Pressable
                style={[styles.pillBtn, { borderColor: colors.border }]}
                onPress={() => setEditingSteps(true)}
              >
                <Text style={styles.pillBtnText}>Edit</Text>
              </Pressable>
            )}
          </View>

          {stepsLoading ? (
            <ActivityIndicator style={{ marginTop: 10 }} />
          ) : !editingSteps ? (
            <>
              <Text style={styles.bigValue}>{stepsGoal.toLocaleString()}</Text>
              <Text style={styles.bigSuffix}>steps / day</Text>
              <Text style={styles.helper}>
                This powers your daily summary, streaks, and steps achievements.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.editRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={stepsDraft}
                  onChangeText={setStepsDraft}
                  keyboardType="number-pad"
                  placeholder="e.g. 10000"
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable
                  style={[
                    styles.primaryBtn,
                    { opacity: savingSteps ? 0.7 : 1 },
                  ]}
                  disabled={savingSteps}
                  onPress={saveStepsGoal}
                >
                  <Text style={styles.primaryBtnText}>
                    {savingSteps ? "Saving…" : "Save"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.ghostBtn}
                onPress={() => {
                  setStepsDraft(String(stepsGoal));
                  setEditingSteps(false);
                }}
              >
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </Pressable>

              <Text style={styles.helper}>Pick 0–50,000.</Text>
            </>
          )}
        </View>

        {/* Plan Goals (graph + selector) */}
        <PlanGoalsCard userId={userId} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
    },
    header: {
      paddingTop: 8,
      paddingBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backBtn: {
      width: 56,
      height: 36,
      justifyContent: "center",
    },
    backText: {
      color: colors.text,
      fontFamily: typography?.fontFamily?.semibold ?? undefined,
      fontSize: 14,
    },
    title: {
      color: colors.text,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      fontSize: 16,
      letterSpacing: -0.2,
    },

    content: {
      paddingBottom: 18,
      paddingTop: 6,
      gap: 12,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    sectionLabel: {
      color: colors.subtle,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      fontFamily: typography?.fontFamily?.semibold ?? undefined,
      marginBottom: 8,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      fontSize: 16,
      letterSpacing: -0.2,
    },

    bigValue: {
      marginTop: 10,
      color: colors.text,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      fontSize: 34,
      letterSpacing: -0.8,
      lineHeight: 38,
    },
    bigSuffix: {
      color: colors.subtle,
      marginTop: 2,
      fontSize: 13,
      fontFamily: typography?.fontFamily?.medium ?? undefined,
    },
    helper: {
      marginTop: 10,
      color: colors.subtle,
      fontSize: 13,
      lineHeight: 18,
    },

    pillBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface,
    },
    pillBtnText: {
      color: colors.text,
      fontFamily: typography?.fontFamily?.semibold ?? undefined,
      fontSize: 13,
    },

    editRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: typography?.fontFamily?.semibold ?? undefined,
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    primaryBtnText: {
      color: colors.onPrimary ?? "#fff",
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      fontSize: 14,
    },

    ghostBtn: {
      marginTop: 10,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    ghostBtnText: {
      color: colors.text,
      fontFamily: typography?.fontFamily?.semibold ?? undefined,
      fontSize: 14,
    },
  });
