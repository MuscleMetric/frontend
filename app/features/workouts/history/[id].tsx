// app/features/workouts/history/[id].tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { supabase } from "../../../../../lib/supabase";

/* ---------- utils ---------- */
const n = (x: any): number => (Number.isFinite(Number(x)) ? Number(x) : 0);

function secondsToHMS(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

/* ---------- types for this screen ---------- */
type SetRow = {
  set_number: number;
  drop_index: number | null;
  reps: number | null;
  weight: number | null;
  time_seconds: number | null;
  distance: number | null;
  notes: string | null;
};

type Wexh = {
  id: string;
  order_index: number | null;
  notes: string | null;
  is_dropset: boolean | null;
  superset_group: string | null;
  superset_index: number | null;
  exercises: { id: string; name: string | null } | null;
  workout_set_history: SetRow[];
};

type HistoryDetail = {
  id: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  workouts: { title: string | null } | null;
  workout_exercise_history: Wexh[];
};

export default function WorkoutHistoryDetail() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const params = useLocalSearchParams();
  const historyId = typeof params.id === "string" ? params.id : undefined;

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<HistoryDetail | null>(null);

  const firstOrNull = <T = any>(rel: any): T | null =>
  Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);


  const load = useCallback(async () => {
    if (!historyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("workout_history")
        .select(
          `
          id, completed_at, duration_seconds, notes,
          workouts ( title ),
          workout_exercise_history (
            id, order_index, notes, is_dropset, superset_group, superset_index,
            exercises ( id, name ),
            workout_set_history ( set_number, drop_index, reps, weight, time_seconds, distance, notes )
          )
        `
        )
        .eq("id", historyId)
        .maybeSingle();

      if (error) throw error;

      const w = firstOrNull<{ title: string | null }>(data?.workouts);

      const normalized: HistoryDetail | null = data
        ? {
            id: String(data.id),
            completed_at: data.completed_at ?? null,
            duration_seconds:
              data.duration_seconds != null
                ? Number(data.duration_seconds)
                : null,
            notes: data.notes ?? null,
            workouts: w ? { title: w.title ?? null } : { title: null },
            workout_exercise_history: (data.workout_exercise_history ?? [])
              .map((w: any) => ({
                id: String(w.id),
                order_index: w.order_index ?? null,
                notes: w.notes ?? null,
                is_dropset: w.is_dropset ?? null,
                superset_group: w.superset_group ?? null,
                superset_index: w.superset_index ?? null,
                exercises: w.exercises
                  ? {
                      id: String(w.exercises.id),
                      name: w.exercises.name ?? null,
                    }
                  : null,
                workout_set_history: (w.workout_set_history ?? []).map(
                  (s: any) => ({
                    set_number: Number(s.set_number),
                    drop_index:
                      s.drop_index != null ? Number(s.drop_index) : null,
                    reps: s.reps != null ? Number(s.reps) : null,
                    weight: s.weight != null ? Number(s.weight) : null,
                    time_seconds:
                      s.time_seconds != null ? Number(s.time_seconds) : null,
                    distance: s.distance != null ? Number(s.distance) : null,
                    notes: s.notes ?? null,
                  })
                ),
              }))
              .sort(
                (a: Wexh, b: Wexh) =>
                  (a.order_index ?? 0) - (b.order_index ?? 0)
              ),
          }
        : null;

      setRow(normalized);
    } catch (e) {
      console.warn("history detail load error:", e);
      setRow(null);
      Alert.alert("Error", "Could not load workout.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [historyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!row) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <Text style={{ color: colors.text }}>Not found.</Text>
      </SafeAreaView>
    );
  }

  // compute totals
  let totalWeight = 0;
  let totalDist = 0;
  let totalCardioTime = 0;
  let hasStrength = false;
  let hasCardio = false;

  for (const w of row.workout_exercise_history) {
    // cardio sets have time/distance; strength have reps/weight
    for (const s of w.workout_set_history) {
      if (s.reps != null || s.weight != null) {
        const wgt = n(s.reps) * n(s.weight);
        if (wgt > 0) hasStrength = true;
        totalWeight += wgt;
      }
      if (s.distance != null || s.time_seconds != null) {
        const dist = n(s.distance);
        const t = n(s.time_seconds);
        if (dist > 0 || t > 0) hasCardio = true;
        totalDist += dist;
        totalCardioTime += t;
      }
    }
  }

  const when = row.completed_at
    ? new Date(row.completed_at).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const durationStr = secondsToHMS(n(row.duration_seconds));

  const Header = () => (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={{ paddingHorizontal: 6, paddingVertical: 2 }}
      >
        <Text
          style={{ color: colors.primaryText, fontSize: 20, fontWeight: "800" }}
        >
          ←
        </Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={styles.title} numberOfLines={2}>
          {row.workouts?.title ?? "Workout"}
        </Text>
        <Text style={styles.subtle}>Completed {when}</Text>
      </View>

      <View style={{ width: 28 }} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {/* Summary */}
        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{durationStr}</Text>
          </View>

          {hasStrength && (
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Weight</Text>
              <Text style={styles.metricValue}>
                {Math.round(totalWeight)} kg
              </Text>
            </View>
          )}

          {hasCardio && (
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Distance</Text>
              <Text style={styles.metricValue}>{totalDist.toFixed(2)} km</Text>
              <Text style={styles.mutedSmall}>
                Cardio time {secondsToHMS(totalCardioTime)}
              </Text>
            </View>
          )}
        </View>

        {/* Exercises */}
        <View style={{ marginTop: 12, gap: 12 }}>
          {row.workout_exercise_history.map((w, idx) => {
            // group drop sets by set_number / drop_index
            const bySet = new Map<number, SetRow[]>();
            for (const s of w.workout_set_history) {
              const key = s.set_number;
              const arr = bySet.get(key) ?? [];
              arr.push(s);
              bySet.set(key, arr);
            }

            // detect kind by looking at first set
            const first = w.workout_set_history[0];
            const isStrength =
              first && (first.reps != null || first.weight != null);

            const sup = w.superset_group
              ? `Superset ${supersetLabel(w.superset_group)}`
              : null;

            // per-exercise total for the pill on the right
            let perTotal = 0;
            if (isStrength) {
              for (const sets of bySet.values()) {
                // sum drops or single
                if (
                  sets.some((s) => s.drop_index != null && s.drop_index > 0)
                ) {
                  perTotal += sets.reduce(
                    (acc, d) => acc + n(d.reps) * n(d.weight),
                    0
                  );
                } else {
                  const s = sets[0];
                  perTotal += n(s.reps) * n(s.weight);
                }
              }
            } else {
              for (const sets of bySet.values()) {
                const s = sets[0];
                perTotal += n(s.distance);
              }
            }

            return (
              <View key={w.id} style={styles.exCard}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.surface,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      marginRight: 10,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      {idx + 1}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.h3}>
                      {w.exercises?.name ?? "Exercise"}
                    </Text>
                    {sup ? (
                      <Text
                        style={[
                          styles.badge,
                          {
                            alignSelf: "flex-start",
                            color: colors.primaryText,
                            marginTop: 4,
                          },
                        ]}
                      >
                        {sup}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={[styles.h3, { color: colors.primaryText }]}>
                    {isStrength
                      ? `${Math.round(perTotal)} kg`
                      : `${perTotal.toFixed(2)} km`}
                  </Text>
                </View>

                <View style={{ marginTop: 10, gap: 6 }}>
                  {[...bySet.keys()]
                    .sort((a, b) => a - b)
                    .map((setNo) => {
                      const entries = bySet.get(setNo) ?? [];
                      const hasDrops =
                        entries.length > 1 || (entries[0]?.drop_index ?? 0) > 0;

                      if (isStrength) {
                        return (
                          <View key={setNo} style={styles.setRow}>
                            <Text
                              style={[
                                styles.setIndex,
                                { color: colors.subtle },
                              ]}
                            >
                              Set {setNo}
                            </Text>
                            {hasDrops ? (
                              <Text style={styles.setText}>
                                {entries
                                  .sort(
                                    (a, b) =>
                                      (a.drop_index ?? 0) - (b.drop_index ?? 0)
                                  )
                                  .map((d) => `${n(d.reps)}×${n(d.weight)}`)
                                  .join(" → ")}{" "}
                                kg
                              </Text>
                            ) : (
                              <Text style={styles.setText}>
                                {n(entries[0]?.reps)} × {n(entries[0]?.weight)}{" "}
                                kg
                              </Text>
                            )}
                          </View>
                        );
                      } else {
                        const s = entries[0];
                        return (
                          <View key={setNo} style={styles.setRow}>
                            <Text
                              style={[
                                styles.setIndex,
                                { color: colors.subtle },
                              ]}
                            >
                              Set {setNo}
                            </Text>
                            <Text style={styles.setText}>
                              {n(s.distance).toFixed(2)} km •{" "}
                              {secondsToHMS(n(s.time_seconds))}
                            </Text>
                          </View>
                        );
                      }
                    })}
                </View>

                {w.notes ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.muted, { marginBottom: 2 }]}>
                      Notes
                    </Text>
                    <Text style={styles.noteBubble}>{w.notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Workout notes */}
        {row.notes ? (
          <View style={[styles.exCard, { marginTop: 6 }]}>
            <Text style={styles.h3}>Workout Notes</Text>
            <Text style={[styles.noteBubble, { marginTop: 6 }]}>
              {row.notes}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- helpers ---------- */
function supersetLabel(groupKey: string) {
  // Turn your stored group key into A/B/C labels deterministically
  // e.g., hash first char -> index; simplest: map unique groups to letters by order
  // For a detail page without session context, just show the first letter fallback:
  return groupKey ? groupKey.slice(0, 1).toUpperCase() : "A";
}

/* ---------- styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.background,
    },
    title: { fontSize: 22, fontWeight: "900", color: colors.text },
    subtle: { color: colors.subtle },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    metricCard: {
      flexBasis: "48%",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    metricLabel: { color: colors.subtle, fontWeight: "700", marginBottom: 2 },
    metricValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
    mutedSmall: { color: colors.muted, fontSize: 12, marginTop: 2 },

    exCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
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

    setRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    setIndex: { fontWeight: "700" },
    setText: { color: colors.text, fontWeight: "700" },

    noteBubble: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      color: colors.text,
    },
  });
