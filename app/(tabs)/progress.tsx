// app/(tabs)/progress.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { useAppTheme } from "../../lib/useAppTheme";
import { router } from "expo-router";

type HistoryRow = {
  id: string;
  completed_at: string | null;
  duration_seconds: number | null;
  workouts: { title: string | null } | null;
  workout_exercise_history: Array<{ id: string }>;
};

export default function Progress() {
  const { session } = useAuth();
  const userId = session?.user?.id || null;

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HistoryRow[]>([]);

  const firstOrNull = <T = any,>(rel: any): T | null =>
    Array.isArray(rel) ? rel[0] ?? null : rel ?? null;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("workout_history")
        .select(
          `
          id,
          completed_at,
          duration_seconds,
          workouts ( title ),
          workout_exercise_history ( id )
        `
        )
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const normalized: HistoryRow[] = (data ?? []).map((r: any) => {
        const w = firstOrNull<{ title: string | null }>(r.workouts);
        return {
          id: String(r.id),
          completed_at: r.completed_at ?? null,
          duration_seconds:
            r.duration_seconds != null ? Number(r.duration_seconds) : null,
          workouts: w ? { title: w.title ?? null } : { title: null },
          workout_exercise_history: Array.isArray(r.workout_exercise_history)
            ? r.workout_exercise_history.map((x: any) => ({ id: String(x.id) }))
            : [],
        };
      });

      setRows(normalized);
    } catch (e) {
      console.warn("progress load error:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!userId) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <Text style={{ color: colors.text }}>
          Please log in to see history.
        </Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.h1}>Workout History</Text>

        {rows.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No workouts saved yet.</Text>
          </View>
        ) : (
          rows.map((r) => {
            const title = r.workouts?.title ?? "Workout";
            const when = r.completed_at
              ? new Date(r.completed_at).toLocaleString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—";
            const duration = formatDuration(r.duration_seconds ?? 0);
            const count = r.workout_exercise_history.length;

            return (
              <Pressable
                key={r.id}
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: "/features/workouts/history/[id]",
                    params: { id: r.id },
                  })
                }
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.title}>{title}</Text>
                  <Text style={[styles.badge, { color: colors.primaryText }]}>
                    {count} ex.
                  </Text>
                </View>

                <View style={{ height: 8 }} />

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={styles.muted}>{when}</Text>
                  <Text
                    style={[
                      styles.muted,
                      { fontWeight: "700", color: colors.text },
                    ]}
                  >
                    {duration}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- helpers ---------- */
function formatDuration(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m ${sec}s`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/* ---------- styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    h1: { fontSize: 22, fontWeight: "900", color: colors.text },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    title: { fontSize: 16, fontWeight: "800", color: colors.text },
    muted: { color: colors.muted },

    badge: {
      fontSize: 12,
      fontWeight: "800",
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
  });
