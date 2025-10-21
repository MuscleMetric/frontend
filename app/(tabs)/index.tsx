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

type LiftProgress = {
  exercise: string;
  from: number; // previous peak
  to: number; // latest peak
  deltaPct: number; // (to - from) / from
};

export default function Home() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);

  // profile / greeting
  const [fullName, setFullName] = useState<string>("User");

  // daily summary
  const [workoutsCompleted, setWorkoutsCompleted] = useState<number>(0);
  const [totalVolumeKg, setTotalVolumeKg] = useState<number>(0);

  // steps (hidden by default; see note below)
  const [stepsToday, setStepsToday] = useState<number | null>(null);
  const stepsGoal = 10000;

  // recent lift progress
  const [liftProgress, setLiftProgress] = useState<LiftProgress[]>([]);

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

        // 1) Profile name
        {
          const { data, error } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", userId)
            .maybeSingle();
          if (!error && data?.name) setFullName(data.name);
        }

        // 2) Workouts completed — prefer view, fallback to counting history
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
            // fallback
            const { count } = await supabase
              .from("workout_history")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId);
            wc = count ?? 0;
          }
          setWorkoutsCompleted(wc);
        }

        // 3) Total volume lifted (kg)
        //    Expects table: workout_sets(user_id, weight_kg or weight, reps, completed_at)
        {
          let vol = 0;
          // Try weight_kg first, fallback to weight
          const tryWeightCol = async (col: "weight_kg" | "weight") => {
            const { data, error } = await supabase
              .from("workout_sets")
              .select(`${col}, reps`)
              .eq("user_id", userId)
              .limit(20000); // cap for safety
            if (error || !Array.isArray(data)) return null;
            return data.reduce((sum: number, s: any) => {
              const w = Number(s[col]) || 0;
              const r = Number(s.reps) || 0;
              return sum + w * r;
            }, 0);
          };

          let sum = await tryWeightCol("weight_kg");
          if (sum == null) sum = await tryWeightCol("weight");
          vol = sum ?? 0;
          setTotalVolumeKg(Math.round(vol));
        }

        // 4) Steps (hidden by default — needs native integration)
        // If you later integrate Apple Health / Google Fit, set stepsToday here.
        if (Platform.OS === "ios") {
          // Example: setStepsToday(await getAppleHealthStepsToday());
          setStepsToday(null); // keep hidden for now
        } else {
          setStepsToday(null);
        }

        // 5) Recent lift progress:
        //    Get recent sets per exercise and compare earlier vs latest peaks.
        //    We compute per exercise: latest max weight vs previous max weight
        //    (graceful fallback if table or data missing).
        {
          const { data, error } = await supabase
            .from("workout_sets")
            .select("exercise_name, reps, weight_kg, weight, completed_at")
            .eq("user_id", userId)
            .order("completed_at", { ascending: false })
            .limit(2000);

          if (!error && Array.isArray(data) && data.length > 0) {
            // normalize weight column
            const rows = data.map((s: any) => ({
              exercise: s.exercise_name ?? "Exercise",
              w: s.weight_kg ?? s.weight ?? 0,
              reps: s.reps ?? 0,
              t: s.completed_at ? new Date(s.completed_at).getTime() : 0,
            }));

            // group by exercise
            const byEx = new Map<string, { t: number; pr: number }[]>();
            for (const r of rows) {
              const est = Number(r.w) || 0; // simple peak metric (you can swap to 1RM calc if you like)
              const arr = byEx.get(r.exercise) ?? [];
              arr.push({ t: r.t, pr: est });
              byEx.set(r.exercise, arr);
            }

            const progress: LiftProgress[] = [];
            byEx.forEach((arr, ex) => {
              // sort by time desc
              arr.sort((a, b) => b.t - a.t);
              const latestPeak = Math.max(...arr.slice(0, 50).map((x) => x.pr)); // last ~50 sets’ peak
              const previousPeak = Math.max(
                ...arr.slice(50, 150).map((x) => x.pr),
                0
              ); // earlier window
              if (!isFinite(latestPeak) || latestPeak <= 0) return;
              const from = previousPeak > 0 ? previousPeak : latestPeak; // avoid huge % if first data
              const to = latestPeak;
              const deltaPct = from > 0 ? (to - from) / from : 0;
              progress.push({ exercise: ex, from, to, deltaPct });
            });

            // pick top 3 improvements
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
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
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
            <View style={{ flexDirection: "row", gap: 12 }}>
              <CardStat
                value={String(workoutsCompleted)}
                label="Workouts Completed"
              />
              <CardStat
                value={formatNumber(totalVolumeKg)}
                label="Total Volume Lifted (kg)"
              />
            </View>
          )}
        </View>

        {/* Steps (hidden unless you wire Apple Health / Google Fit) */}
        {stepsToday != null && (
          <View style={styles.card}>
            <Text style={styles.h3}>Total Steps</Text>
            <Text style={styles.big}>{formatNumber(stepsToday)}</Text>
            <Text>/{formatNumber(stepsGoal)} steps</Text>
          </View>
        )}

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
            <Text style={{ color: "#6b7280" }}>
              Keep logging sets to see progress trends here.
            </Text>
          ) : (
            <Text style={{ color: "#6b7280" }}>
              Complete some workouts and your progress will appear here.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CardStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={{ opacity: 0.8 }}>{label}</Text>
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
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ fontWeight: "700" }}>{name}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text>
          {from} → {to}
        </Text>
        <Text style={{ fontWeight: "700" }}>{delta}</Text>
      </View>
    </View>
  );
}

/* -------- styles & utils -------- */
const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  hi: { fontSize: 22, fontWeight: "800" },
  h2: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  h3: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  stat: { flex: 1, backgroundColor: "#F4F6FA", padding: 16, borderRadius: 16 },
  statValue: { fontSize: 28, fontWeight: "900", marginBottom: 6 },
  big: {
    fontSize: 24,
    fontWeight: "800",
  },
});

function formatNumber(n: number) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}
