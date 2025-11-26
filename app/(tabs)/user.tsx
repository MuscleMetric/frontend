// app/(tabs)/user.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAuth } from "../../lib/useAuth";
import QuickUpdateModal from "../features/profile/QuickUpdateModal";
import { toISODateUTC } from "../utils/dates";
import { AppState } from "react-native";
import { useRef } from "react";

import {
  Header,
  SectionCard,
  StatCard,
  RingProgress,
  PlanRow,
  SettingRow,
} from "../_components";
import { useAppTheme } from "../../lib/useAppTheme";
import { usePlanGoals } from "../features/goals/hooks/usePlanGoals";

type PlanRowType = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  statusColor: string;
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

function parseStart(notes?: string | null): number | null {
  if (!notes) return null;
  try {
    const obj = JSON.parse(notes);
    if (typeof obj?.start === "number") return obj.start;
  } catch {}
  return null;
}

function coerceUnitRound(
  value: number,
  type: "exercise_weight" | "exercise_reps" | "distance" | "time"
): number {
  const roundQuarter = (n: number) => Math.round(n * 4) / 4;
  const roundTime = (s: number) => Math.round(s / 5) * 5;
  const roundDistance = (d: number) => Math.round(d * 10) / 10;

  switch (type) {
    case "exercise_weight":
    case "exercise_reps":
      return roundQuarter(value);
    case "distance":
      return roundDistance(value);
    case "time":
      return roundTime(value);
    default:
      return value;
  }
}

export default function UserScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [showWeightModal, setShowWeightModal] = useState(false);

  const { colors, dark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // NEW: use plan goals hook
  const { plan, goals } = usePlanGoals(userId);

  // NEW: ring state
  const [goalsRingProgress, setGoalsRingProgress] = useState(0); // 0–1
  const [goalsRingLabel, setGoalsRingLabel] = useState("0%");
  const [goalsRingLoading, setGoalsRingLoading] = useState(true);

  // DB-backed state
  const [profile, setProfile] = useState<{
    name: string | null;
    email: string | null;
    created_at: string;
    settings: any;
  } | null>(null);

  const [workoutsCompleted, setWorkoutsCompleted] = useState<number>(0);
  const [weeklyStreak, setWeeklyStreak] = useState<number>(0);

  const [achievementsTotal, setAchievementsTotal] = useState<number>(0);
  const [achievementsUnlocked, setAchievementsUnlocked] = useState<number>(0);

  const [plans, setPlans] = useState<PlanRowType[]>([]);

  // NEW step stats UI state
  const [stepsStreak, setStepsStreak] = useState<number>(0);
  const [stepsDaysMetTotal, setStepsDaysMetTotal] = useState<number>(0);
  const [profileTz, setProfileTz] = useState<string>("UTC");
  const appState = useRef(AppState.currentState);

  const name =
    profile?.name ?? (session?.user?.user_metadata as any)?.name ?? "User";
  const email = profile?.email ?? session?.user?.email ?? "user@example.com";
  const joinedAt =
    profile?.created_at ??
    session?.user?.created_at ??
    new Date().toISOString();
  const joinedText = useMemo(() => formatMonthYear(joinedAt), [joinedAt]);

  const ringModeLabel = plan && goals && goals.length > 0 ? "Plan" : "Weekly";

  const ringColor =
    goalsRingProgress < 1 / 3
      ? "#ef4444"
      : goalsRingProgress < 2 / 3
      ? "#eab308"
      : colors.successBg ?? colors.primary;

  useEffect(() => {
    if (userId) fetchProfile();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setGoalsRingProgress(0);
      setGoalsRingLabel("0%");
      setGoalsRingLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setGoalsRingLoading(true);
      try {
        // ---- CASE 1: user has a plan with goals -> average progress over up to 3 exercises ----
        if (plan && goals && goals.length > 0) {
          const exerciseGoals = goals
            .filter((g: any) => g.exercises?.id)
            .slice(0, 3);

          if (!exerciseGoals.length) {
            throw new Error("No exercise-based plan goals.");
          }

          const exerciseIds = exerciseGoals.map(
            (g: any) => g.exercises!.id as string
          );

          const goalByExerciseId: Record<string, any> = {};
          exerciseGoals.forEach((g: any) => {
            if (g.exercises?.id) {
              goalByExerciseId[g.exercises.id] = g;
            }
          });

          // get all history for those exercises in the plan date range
          const { data, error } = await supabase
            .from("workout_history")
            .select(
              `
            id,
            completed_at,
            workout_exercise_history!inner(
              exercise_id,
              workout_set_history (
                reps,
                weight,
                time_seconds,
                distance
              )
            )
          `
            )
            .eq("user_id", userId)
            .gte("completed_at", plan.start_date)
            .lte("completed_at", plan.end_date)
            .order("completed_at", { ascending: true });

          if (error) throw error;

          // latest actual value per exercise
          const latestByExercise: Record<string, number> = {};

          (data ?? []).forEach((row: any) => {
            const histories = row.workout_exercise_history ?? [];
            histories.forEach((eh: any) => {
              const exId = eh.exercise_id as string;
              if (!exerciseIds.includes(exId)) return;

              const g = goalByExerciseId[exId];
              if (!g) return;

              const sets = eh.workout_set_history ?? [];
              if (!sets.length) return;

              let rawVal = 0;
              switch (g.type) {
                case "exercise_weight":
                  rawVal = Math.max(
                    ...sets.map((s: any) => Number(s.weight ?? 0))
                  );
                  break;
                case "exercise_reps":
                  rawVal = Math.max(
                    ...sets.map((s: any) => Number(s.reps ?? 0))
                  );
                  break;
                case "distance":
                  rawVal = sets.reduce(
                    (sum: number, s: any) => sum + Number(s.distance ?? 0),
                    0
                  );
                  break;
                case "time":
                  rawVal = sets.reduce(
                    (sum: number, s: any) => sum + Number(s.time_seconds ?? 0),
                    0
                  );
                  break;
                default:
                  rawVal = 0;
              }

              const val = coerceUnitRound(rawVal, g.type);
              latestByExercise[exId] = val; // rows ordered asc, so this ends up as latest
            });
          });

          // compute per-goal progress and average
          const progresses: number[] = [];
          exerciseGoals.forEach((g: any) => {
            const exId = g.exercises!.id as string;
            const target = Number(g.target_number);
            const startParsed = parseStart(g.notes);
            const start = typeof startParsed === "number" ? startParsed : 0;

            const actual =
              latestByExercise[exId] !== undefined
                ? latestByExercise[exId]
                : start;

            if (target <= start) {
              // weird config; treat as done if we're at/above target
              progresses.push(actual >= target ? 1 : 0);
            } else {
              const frac = (actual - start) / (target - start);
              const clamped = Math.max(0, Math.min(1, frac));
              progresses.push(clamped);
            }
          });

          const avg =
            progresses.length > 0
              ? progresses.reduce((a, b) => a + b, 0) / progresses.length
              : 0;

          if (!cancelled) {
            setGoalsRingProgress(avg);
            setGoalsRingLabel(`${Math.round(avg * 100)}%`);
          }
          return;
        }

        // ---- CASE 2: no plan/goals -> weekly workouts vs goal ----
        const now = new Date();
        const wk = weekKeySundayLocal(now);

        const { data: weekly, error: weeklyErr } = await supabase
          .from("user_weekly_workout_stats")
          .select("goal, completed")
          .eq("user_id", userId)
          .eq("week_key", wk)
          .maybeSingle();

        if (weeklyErr) throw weeklyErr;

        let goalNum = Number(weekly?.goal ?? 0);
        let completedNum = Number(weekly?.completed ?? 0);

        // fallback to profile weekly_workout_goal if no row yet
        if (!weekly) {
          const { data: prof, error: profErr } = await supabase
            .from("profiles")
            .select("weekly_workout_goal")
            .eq("id", userId)
            .maybeSingle();
          if (profErr) throw profErr;
          goalNum =
            prof?.weekly_workout_goal != null
              ? Number(prof.weekly_workout_goal)
              : 3;
          completedNum = 0;
        }

        const frac =
          goalNum > 0 ? Math.max(0, Math.min(1, completedNum / goalNum)) : 0;

        if (!cancelled) {
          setGoalsRingProgress(frac);
          setGoalsRingLabel(`${completedNum}/${goalNum || "?"}`);
        }
      } catch (e) {
        console.warn("Goals ring load error:", e);
        if (!cancelled) {
          setGoalsRingProgress(0);
          setGoalsRingLabel("0%");
        }
      } finally {
        if (!cancelled) setGoalsRingLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, plan?.id, goals]);

  async function rolloverWeeklyIfNeeded(userId: string) {
    // 1) read goal + current week_key from profile.settings
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("weekly_workout_goal, settings")
      .eq("id", userId)
      .maybeSingle();

    const goal = Number(profileRow?.weekly_workout_goal ?? 0) || 3;
    const lastKey = profileRow?.settings?.workout_week_key as
      | string
      | undefined;

    const nowKey = weekKeySundayLocal(new Date());
    if (lastKey === nowKey) return; // same week, nothing to do

    // 2) finalize previous week (if we had one)
    if (lastKey) {
      // compute "met" from existing row
      const { data: prev } = await supabase
        .from("user_weekly_workout_stats")
        .select("completed, goal")
        .eq("user_id", userId)
        .eq("week_key", lastKey)
        .maybeSingle();

      const prevCompleted = Number(prev?.completed ?? 0);
      const prevGoal = Number(prev?.goal ?? goal);
      const met = prevCompleted >= prevGoal;

      await supabase.from("user_weekly_workout_stats").upsert(
        {
          user_id: userId,
          week_key: lastKey,
          goal: prevGoal,
          completed: prevCompleted,
          met,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,week_key" }
      );
    }

    // 3) open the new week with current goal
    await supabase.from("user_weekly_workout_stats").upsert(
      {
        user_id: userId,
        week_key: nowKey,
        goal,
        completed: 0,
        met: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_key" }
    );

    // 4) store the active week key in profile.settings
    await supabase
      .from("profiles")
      .update({
        settings: {
          ...(profileRow?.settings ?? {}),
          workout_week_key: nowKey,
        },
      })
      .eq("id", userId);
  }

  async function syncTimezoneIfChanged(userId: string) {
    try {
      const deviceTz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      // read current profile timezone
      const { data } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", userId)
        .maybeSingle();

      const currentTz = data?.timezone || "UTC";
      setProfileTz(currentTz);

      if (deviceTz && deviceTz !== currentTz) {
        await supabase
          .from("profiles")
          .update({ timezone: deviceTz })
          .eq("id", userId);
        setProfileTz(deviceTz);
        // You can optionally trigger recompute here if you want immediate refresh:
        // await supabase.rpc('recompute_step_stats', { p_user_id: userId });
      }
    } catch (e) {
      console.warn("syncTimezoneIfChanged error", e);
    }
  }

  async function fetchStepStats(uid: string) {
    const { data, error } = await supabase
      .from("user_steps_stats")
      .select(
        "streak_current, streak_best, days_met_30, days_met_90, days_met_total"
      )
      .eq("user_id", uid)
      .maybeSingle();

    if (!error && data) {
      setStepsStreak(data.streak_current ?? 0);
      setStepsDaysMetTotal(data.days_met_total ?? 0);
    } else {
      setStepsStreak(0);
      setStepsDaysMetTotal(0);
    }
  }

  useEffect(() => {
    if (!userId) return;

    // initial run
    syncTimezoneIfChanged(userId);
    fetchStepStats(userId);

    rolloverWeeklyIfNeeded(userId);

    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        syncTimezoneIfChanged(userId);
        fetchStepStats(userId);
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, [userId]);

  async function fetchProfile() {
    try {
      setLoading(true);

      // 1) Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "name, email, created_at, settings, height, weight, weekly_streak"
        )
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);
        // use DB-backed weekly streak, falling back to 0
        const streakFromDb =
          profileData.weekly_streak !== null &&
          profileData.weekly_streak !== undefined
            ? Number(profileData.weekly_streak)
            : 0;
        setWeeklyStreak(Number.isFinite(streakFromDb) ? streakFromDb : 0);
      }

      // 2) Totals
      const { data: totals } = await supabase
        .from("v_user_totals")
        .select("workouts_completed")
        .eq("user_id", userId)
        .maybeSingle();
      setWorkoutsCompleted(Number(totals?.workouts_completed ?? 0));

      // 3) Streak
      const { data: history } = await supabase
        .from("workout_history")
        .select("completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(365);

      // 4) Achievements
      const [{ count: totalCount }, { count: unlockedCount }] =
        await Promise.all([
          supabase
            .from("achievements")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("user_achievements")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId),
        ]);
      setAchievementsTotal(totalCount ?? 0);
      setAchievementsUnlocked(unlockedCount ?? 0);

      // 5) Plans
      const { data: plansData } = await supabase
        .from("plans")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .eq("is_completed", true)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (Array.isArray(plansData) && plansData.length > 0) {
        const rows = plansData.map((p) => ({
          id: p.id,
          title: p.title ?? "Plan",
          subtitle: `Completed • Last Active: ${formatShortDate(p.updated_at)}`,
          status: "Completed",
          statusColor: "#22c55e",
        }));
        setPlans(rows);
      } else {
        setPlans([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  if (!userId) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={dark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <Text style={{ color: colors.text }}>Please log in.</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Header
              name={name}
              email={email}
              joined={joinedText}
              onEdit={() => router.push("/features/profile/EditProfile")}
            />

            {/* Stats */}
            <View style={styles.row}>
              <StatCard
                value={workoutsCompleted}
                label="Workouts"
                tint={colors.primaryBg}
              />
              <StatCard
                value={weeklyStreak}
                label="Weekly Streak"
                tint={colors.successBg}
              />
            </View>

            <View style={[styles.row, { marginTop: 8 }]}>
              <StatCard
                value={stepsStreak}
                label="Step Streak"
                tint={colors.successBg}
              />
              <StatCard
                value={stepsDaysMetTotal}
                label="Days Met (All)"
                tint={colors.primaryBg}
              />
            </View>

            {/* Quick Update Section */}
            <SectionCard>
              <View style={styles.centerButtonContainer}>
                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setShowWeightModal(true)}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: dark ? colors.text : "#FFFFFF" },
                    ]}
                  >
                    Update Weight
                  </Text>
                </Pressable>
              </View>
            </SectionCard>

            <QuickUpdateModal
              visible={showWeightModal}
              onClose={() => {
                setShowWeightModal(false);
                fetchProfile();
              }}
              userId={userId}
              field="weight"
              currentValue={profile?.settings?.weight ?? null}
            />

            {/* Achievements */}
            <SectionCard>
              <Text style={styles.sectionTitle}>Achievements Completed</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.subtle}>
                  {achievementsUnlocked} of {achievementsTotal}
                </Text>
                <RingProgress
                  size={64}
                  stroke={8}
                  progress={
                    achievementsTotal > 0
                      ? achievementsUnlocked / achievementsTotal
                      : 0
                  }
                  label={
                    achievementsTotal > 0
                      ? `${Math.round(
                          (achievementsUnlocked / achievementsTotal) * 100
                        )}%`
                      : "0%"
                  }
                />
              </View>
              <Pressable
                style={[styles.button, { backgroundColor: colors.successBg }]}
                onPress={() =>
                  router.push("/features/achievements/achievements")
                }
              >
                <Text
                  style={[styles.buttonText, { color: colors.successText }]}
                >
                  View Achievements
                </Text>
              </Pressable>
            </SectionCard>

            {/* Goals */}
            {/* Goals */}
            <SectionCard tint={colors.primaryBg}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                Goals
              </Text>

              <Text style={[styles.body, { marginBottom: 8 }]}>
                {plan && goals && goals.length > 0
                  ? "Average progress towards your current plan exercise goals."
                  : "Weekly workout goal progress."}
              </Text>

              <View style={styles.rowBetween}>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.primaryBg }]}
                  onPress={() => router.push("/features/goals/goals")}
                >
                  <Text style={[styles.buttonText, { color: colors.primary }]}>
                    Manage Goals
                  </Text>
                </Pressable>

                <View style={{ alignItems: "center" }}>
                  {goalsRingLoading ? (
                    <RingProgress size={64} stroke={8} progress={0} label="…" />
                  ) : (
                    <>
                      {/* If your RingProgress supports a color/tint prop, use it */}
                      <RingProgress
                        size={64}
                        stroke={8}
                        progress={goalsRingProgress}
                        label={goalsRingLabel}
                        // tweak this prop name to match your RingProgress implementation
                        color={ringColor}
                      />
                      <Text style={styles.ringModeLabel}>{ringModeLabel}</Text>
                    </>
                  )}
                </View>
              </View>
            </SectionCard>

            {/* Plan history */}
            <Text style={styles.groupTitle}>Plan History</Text>
            {loading && (
              <View style={{ paddingVertical: 6 }}>
                <ActivityIndicator />
              </View>
            )}
            {!loading && plans.length === 0 && (
              <SectionCard>
                <Text style={styles.subtle}>
                  No plans have been completed yet.
                </Text>
              </SectionCard>
            )}
          </View>
        }
        data={plans}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <PlanRow
            title={item.title}
            subtitle={item.subtitle}
            status={item.status}
            statusColor={item.statusColor}
            onPress={() => Alert.alert(item.title)}
          />
        )}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 16 }}>
            <Text style={styles.groupTitle}>Settings</Text>

            <Pressable style={styles.logout} onPress={onLogout}>
              <Text style={{ color: "#ef4444", fontWeight: "700" }}>
                Logout 
              </Text>
            </Pressable>
          </View>
        }
      />
    </>
  );
}

/* ---------- Themed styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center" },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },

    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 8,
      color: colors.text,
    },
    groupTitle: {
      fontSize: 18,
      fontWeight: "800",
      marginTop: 4,
      marginBottom: 8,
      color: colors.text,
    },
    button: {
      marginTop: 10,
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    buttonText: { fontWeight: "700" },
    body: { fontSize: 14, color: colors.text },
    subtle: { color: colors.subtle },

    logout: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "flex-start",
    },
    centerButtonContainer: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    primaryButton: {
      paddingVertical: 18,
      paddingHorizontal: 32,
      borderRadius: 14,
    },
    primaryButtonText: {
      fontWeight: "700",
      fontSize: 20,
      textAlign: "center",
    },
    ringModeLabel: {
      marginTop: 2,
      fontSize: 11,
      color: colors.subtle,
      textAlign: "center",
    },
  });

/* ---------- Helpers ---------- */
function formatMonthYear(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "Jan 2024";
  }
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/** Compute consecutive-day streak up to today from ISO date strings */
function computeDayStreak(isoDates: string[]): number {
  if (!isoDates.length) return 0;
  const daysSet = new Set(isoDates.map((d) => new Date(d).toDateString()));
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = cursor.toDateString();
    if (daysSet.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        const key2 = cursor.toDateString();
        if (daysSet.has(key2)) continue;
      }
      break;
    }
  }
  return streak;
}
