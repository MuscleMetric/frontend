// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  SafeAreaView,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { useAppTheme } from "../../lib/useAppTheme";
import { Pedometer } from "expo-sensors";
import { PermissionsAndroid } from "react-native";
import { AppState } from "react-native";
import {
  registerBackgroundFetch,
  onAppActiveSync,
} from "../features/steps/stepsSync";

type LiftProgress = {
  exercise: string;
  from: number;
  to: number;
  deltaPct: number;
};

export default function Home() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);

  // profile / greeting
  const [fullName, setFullName] = useState<string>("User");

  // daily summary
  const [workoutsCompleted, setWorkoutsCompleted] = useState<number>(0);
  const [totalVolumeKg, setTotalVolumeKg] = useState<number>(0);

  // CHANGE your steps state to default to 0 and keep "unavailable" flag
  const [stepsToday, setStepsToday] = useState<number>(0);
  const [stepsAvailable, setStepsAvailable] = useState<boolean>(true);
  const [stepsGoal, setStepsGoal] = useState<number>(10000);

  // recent lift progress
  const [liftProgress, setLiftProgress] = useState<LiftProgress[]>([]);

  // ADD helper to get start of today (local)
  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  useEffect(() => {
    if (!userId) return;
    registerBackgroundFetch();
    onAppActiveSync();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") onAppActiveSync();
    });
    return () => sub.remove();
  }, [userId]);

  // ADD this effect (separate from your big data-loading effect)
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;

    async function askAndroidPermissionIfNeeded() {
      if (Platform.OS !== "android") return true;
      // Android 10+ needs runtime permission
      try {
        const status = await PermissionsAndroid.request(
          "android.permission.ACTIVITY_RECOGNITION"
        );
        return status === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }

    async function loadTodayStepsOnce() {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!available) {
          if (alive) setStepsAvailable(false);
          return;
        }
        if (Platform.OS === "android") {
          const ok = await askAndroidPermissionIfNeeded();
          if (!ok) {
            if (alive) setStepsAvailable(false);
            return;
          }
        }
        const start = startOfToday();
        const end = new Date();
        const count = await Pedometer.getStepCountAsync(start, end);
        if (alive) {
          setStepsAvailable(true);
          setStepsToday(count?.steps ?? 0);
        }
      } catch {
        if (alive) setStepsAvailable(false);
      }
    }

    // initial load
    loadTodayStepsOnce();

    // live updates (fires with small deltas; we re-query to keep “today” accurate)
    sub = Pedometer.watchStepCount(async () => {
      await loadTodayStepsOnce();
    });

    // also refresh every ~60s in case the watcher is quiet
    const interval = setInterval(loadTodayStepsOnce, 60_000);

    return () => {
      alive = false;
      if (sub) sub.remove();
      clearInterval(interval);
    };
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = useMemo(() => {
    const src =
      (session?.user?.user_metadata as any)?.name ??
      fullName ??
      session?.user?.email ??
      "there";
    if (!src) return "there";
    return String(src).split(" ")[0] || "there";
  }, [session?.user?.user_metadata, fullName, session?.user?.email]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        setLoading(true);

        // 1) Profile name + steps goal
        {
          const { data, error } = await supabase
            .from("profiles")
            .select("name, steps_goal, settings")
            .eq("id", userId)
            .maybeSingle();

          if (!error && data) {
            if (data.name) setFullName(data.name);

            // prefer the column; fall back to settings JSON if you used that before
            const fromColumn =
              typeof data.steps_goal === "number" ? data.steps_goal : null;
            const fromSettings = (() => {
              try {
                const sg = (data as any)?.settings?.steps_goal;
                return typeof sg === "number" ? sg : Number(sg);
              } catch {
                return null;
              }
            })();

            const goal = Number.isFinite(fromColumn)
              ? fromColumn!
              : Number.isFinite(fromSettings!)
              ? Number(fromSettings)
              : 10000;

            // clamp to a sensible range (optional)
            const safeGoal = Math.max(0, Math.min(50000, Math.round(goal)));
            setStepsGoal(safeGoal);
          }
        }

        // 2) Workouts completed
        {
          let wc = 0;
          const { data, error } = await supabase
            .from("v_user_totals")
            .select("workouts_completed")
            .eq("user_id", userId)
            .maybeSingle();

          if (!error && data?.workouts_completed != null) {
            wc = Number(data.workouts_completed);
          } else {
            const { count } = await supabase
              .from("workout_history")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId);
            wc = count ?? 0;
          }
          setWorkoutsCompleted(wc);
        }

        // 3) Total volume lifted (kg)
        {
          const tryWeightCol = async (col: "weight_kg" | "weight") => {
            const { data, error } = await supabase
              .from("workout_sets")
              .select(`${col}, reps`)
              .eq("user_id", userId)
              .limit(20000);
            if (error || !Array.isArray(data)) return null;
            return data.reduce((sum: number, s: any) => {
              const w = Number(s[col]) || 0;
              const r = Number(s.reps) || 0;
              return sum + w * r;
            }, 0);
          };

          let sum = await tryWeightCol("weight_kg");
          if (sum == null) sum = await tryWeightCol("weight");
          setTotalVolumeKg(Math.round(sum ?? 0));
        }

        // 4) Recent lift progress
        {
          const { data, error } = await supabase
            .from("workout_sets")
            .select("exercise_name, reps, weight_kg, weight, completed_at")
            .eq("user_id", userId)
            .order("completed_at", { ascending: false })
            .limit(2000);

          if (!error && Array.isArray(data) && data.length > 0) {
            const rows = data.map((s: any) => ({
              exercise: s.exercise_name ?? "Exercise",
              w: s.weight_kg ?? s.weight ?? 0,
              reps: s.reps ?? 0,
              t: s.completed_at ? new Date(s.completed_at).getTime() : 0,
            }));

            const byEx = new Map<string, { t: number; pr: number }[]>();
            for (const r of rows) {
              const pr = Number(r.w) || 0;
              const arr = byEx.get(r.exercise) ?? [];
              arr.push({ t: r.t, pr });
              byEx.set(r.exercise, arr);
            }

            const progress: LiftProgress[] = [];
            byEx.forEach((arr, ex) => {
              arr.sort((a, b) => b.t - a.t);
              const latestPeak = Math.max(...arr.slice(0, 50).map((x) => x.pr));
              const previousPeak = Math.max(
                ...arr.slice(50, 150).map((x) => x.pr),
                0
              );
              if (!isFinite(latestPeak) || latestPeak <= 0) return;
              const from = previousPeak > 0 ? previousPeak : latestPeak;
              const to = latestPeak;
              const deltaPct = from > 0 ? (to - from) / from : 0;
              progress.push({ exercise: ex, from, to, deltaPct });
            });

            progress.sort((a, b) => b.deltaPct - a.deltaPct);
            setLiftProgress(progress.slice(0, 3));
          } else {
            setLiftProgress([]);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        {/* Greeting */}
        <View style={styles.card}>
          <Text style={styles.hi}>
            {greeting}, {firstName} 👋
          </Text>
        </View>
        {/* Daily Summary */}
        <View style={styles.card}>
          <Text style={styles.h2}>Daily Summary</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <CardStat
                value={String(workoutsCompleted)}
                label="Workouts Completed"
              />
              <CardStat
                value={formatNumber(totalVolumeKg)}
                label="Total Volume (kg)"
              />
              {stepsAvailable && (
                <CardStat
                  value={formatNumber(stepsToday)}
                  label={`Steps (${formatNumber(stepsGoal)} goal)`}
                />
              )}
            </View>
          )}
        </View>

        {/* Recent Lift Progress */}
        <View style={styles.card}>
          <Text style={styles.h3}>Recent Lift Progress</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : liftProgress.length > 0 ? (
            <>
              {liftProgress.map((lp) => (
                <LiftRow
                  key={lp.exercise}
                  name={lp.exercise}
                  from={`${Math.round(lp.from)}kg`}
                  to={`${Math.round(lp.to)}kg`}
                  delta={`${lp.deltaPct > 0 ? "+" : ""}${(
                    lp.deltaPct * 100
                  ).toFixed(1)}%`}
                />
              ))}
            </>
          ) : workoutsCompleted > 0 ? (
            <Text style={styles.subtle}>
              Keep logging sets to see progress trends here.
            </Text>
          ) : (
            <Text style={styles.subtle}>
              Complete some workouts and your progress will appear here.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CardStat({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.subtle}>{label}</Text>
    </View>
  );
}

function LiftRow({
  name,
  from,
  to,
  delta,
}: {
  name: string;
  from: string;
  to: string;
  delta: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={styles.h3}>{name}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={styles.text}>
          {from} → {to}
        </Text>
        <Text style={styles.h3}>{delta}</Text>
      </View>
    </View>
  );
}

/* -------- themed styles & utils -------- */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    hi: { fontSize: 22, fontWeight: "800", color: colors.text },
    h2: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
      color: colors.text,
    },
    h3: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 8,
      color: colors.text,
    },
    text: { color: colors.text },
    subtle: { color: colors.subtle },
    stat: {
      flex: 1,
      minWidth: 110,
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    statValue: {
      fontSize: 28,
      fontWeight: "900",
      marginBottom: 6,
      color: colors.text,
    },
    big: { fontSize: 24, fontWeight: "800", color: colors.text },
  });

function formatNumber(n: number) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}
