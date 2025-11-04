// app/features/home/muscleDetail.tsx
import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAppTheme } from "../../../lib/useAppTheme";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";

type Row = {
  completed_at: string;
  exercise_name: string;
  reps: number | null;
  weight: number | null; // kg
  volume: number; // reps*weight (0 for cardio)
};

export default function MuscleDetailScreen() {
  const { muscle } = useLocalSearchParams<{ muscle: string }>();
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const s = React.useMemo(() => styles(colors), [colors]);

  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Row[]>([]);

  React.useEffect(() => {
    if (!userId || !muscle) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // last 7 days (rolling)
        const { data, error } = await supabase.rpc("muscle_sets_last7d", {
          p_user_id: userId,
          p_muscle_name: String(muscle),
        });

        if (!alive) return;
        if (error) {
          console.log("muscle detail error", error);
          setRows([]);
        } else {
          setRows((data as Row[]) ?? []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, muscle]);

  const totalVol = rows.reduce((s, r) => s + (r.volume || 0), 0);

  function groupByDay(rows: Row[]) {
    const byDay = new Map<string, { sets: Row[]; totalKg: number }>();

    rows.forEach((r) => {
      const iso = String(r.completed_at).slice(0, 10);
      const vol = Math.max(0, Number(r.reps || 0) * Number(r.weight || 0));
      const bucket = byDay.get(iso) ?? { sets: [], totalKg: 0 };
      bucket.sets.push(r); // <-- keep Row (nullable reps/weight)
      bucket.totalKg += vol;
      byDay.set(iso, bucket);
    });

    const days = Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([iso, b]) => ({
        iso,
        totalKg: Math.round(b.totalKg),
        sets: b.sets, // <-- Row[]
      }));

    // attach series per day
    days.forEach((d) => {
      d.sets.sort((a, b) => (a.completed_at < b.completed_at ? -1 : 1));
      (d as any).seriesKg = d.sets.map((s) =>
        Math.max(0, Number(s.reps || 0) * Number(s.weight || 0))
      );
    });

    return days as Array<{
      iso: string;
      totalKg: number;
      sets: Row[]; // <-- Row[]
      seriesKg: number[];
    }>;
  }

  function formatDay(iso: string) {
    const d = new Date(iso + "T00:00:00");
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(d);
    } catch {
      return iso;
    }
  }

  function formatNumber(n: number) {
    try {
      return new Intl.NumberFormat().format(n);
    } catch {
      return String(n);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        <View style={s.card}>
          <Text style={s.title}>{muscle}</Text>
          <Text style={s.subtle}>
            Last 7 days • Total volume:{" "}
            <Text style={s.strong}>
              {formatNumber(Math.round(totalVol))} kg
            </Text>
          </Text>

          {/* inside your MuscleDetailScreen render */}
          {loading ? (
            <ActivityIndicator style={{ marginTop: 12 }} />
          ) : rows.length === 0 ? (
            <Text style={s.subtle}>
              No sets found for this muscle in the last 7 days.
            </Text>
          ) : (
            <View style={{ gap: 16 }}>
              {groupByDay(rows).map((day) => (
                <View key={day.iso} style={s.dayCard}>
                  {/* Day header with total + sparkline */}
                  <View style={s.dayHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.section}>{formatDay(day.iso)}</Text>
                      <Text style={s.subtle}>
                        Total:&nbsp;
                        <Text style={s.strong}>
                          {formatNumber(day.totalKg)} kg
                        </Text>
                      </Text>
                    </View>
                  </View>

                  {/* Sets list */}
                  <View style={{ marginTop: 6 }}>
                    {day.sets.map((set, i) => {
                      const vol = Math.max(
                        0,
                        Number(set.reps || 0) * Number(set.weight || 0)
                      );
                      return (
                        <View key={i} style={{ marginTop: i === 0 ? 0 : 6 }}>
                          <Text style={s.exercise}>
                            {set.exercise_name ?? "Exercise"}
                          </Text>
                          <Text style={s.setRow}>
                            {set.reps} × {set.weight} kg
                            <Text style={s.dim}> • </Text>
                            {formatNumber(vol)} kg
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginBottom: 6,
    },
    section: {
      color: colors.subtle,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      marginBottom: 6,
    },
    subtle: { color: colors.subtle, marginBottom: 6 },
    strong: { color: colors.text, fontWeight: "800" },
    exercise: { color: colors.text, fontWeight: "800", fontSize: 16 },
    setRow: { color: colors.text, marginTop: 4 },
    dim: { color: colors.subtle, opacity: 0.7 },
    dayCard: {
      backgroundColor: colors.surface ?? colors.card,
      padding: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dayHeader: { flexDirection: "row", alignItems: "center" },
  });
