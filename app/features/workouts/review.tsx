// app/features/workouts/review.tsx
import React, { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAppTheme } from "../../../lib/useAppTheme";
import {
  getReviewPayload,
  clearReviewPayload,
  type ReviewPayload,
  type StrengthSet,
  type CardioSet,
} from "../../../lib/sessionStore";
import { useAuth } from "../../../lib/authContext";
import { saveCompletedWorkout } from "../../../lib/saveWorkout";
import { supabase } from "../../../lib/supabase";
import { requireUserId } from "../../../lib/authGuards";

/* ---------- utils ---------- */
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

function n(x: any): number {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

function sumStrengthSet(set: StrengthSet, dropMode?: boolean) {
  if (dropMode) {
    const drops = set.drops ?? [];
    return drops.reduce((acc, d) => acc + n(d.reps) * n(d.weight), 0);
  }
  return n(set.reps) * n(set.weight);
}

function sumCardioSet(set: CardioSet) {
  return { dist: n(set.distance), time: n(set.timeSec) };
}

/** Sunday (local) week key, e.g. "2025-10-26" */
function weekKeySundayLocal(d: Date) {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0 = Sunday
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - dow);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Increment the 'completed' count for the current local week */
async function bumpWeeklyCompleted(userId: string) {
  const key = weekKeySundayLocal(new Date());
  await supabase.rpc("increment_weekly_completed", {
    p_user_id: userId,
    p_week_key: key,
  });
}

/* ---------- main ---------- */
export default function ReviewWorkoutScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<ReviewPayload | null>(null);

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // timings from route params
  const params = useLocalSearchParams();
  const planWorkoutId =
    typeof params.planWorkoutId === "string" ? params.planWorkoutId : undefined;
  const elapsedSec = useMemo(
    () => Math.max(0, parseInt(String(params.elapsedSec || "0"), 10) || 0),
    [params.elapsedSec]
  );
  const bonusSec = useMemo(
    () => Math.max(0, parseInt(String(params.bonusSec || "0"), 10) || 0),
    [params.bonusSec]
  );
  const totalSec = useMemo(
    () => Math.max(0, parseInt(String(params.totalSec || "0"), 10) || 0),
    [params.totalSec]
  );

  // Load payload safely on focus (avoid early “no data” alert)
  useFocusEffect(
    React.useCallback(() => {
      let p = getReviewPayload();
      if (p) {
        setPayload(p);
        return;
      }
      const id = setTimeout(() => {
        p = getReviewPayload();
        if (p) setPayload(p);
        else router.replace("/(tabs)/workout"); // silently go back if missing
      }, 10);
      return () => clearTimeout(id);
    }, [])
  );

  if (!payload) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const { workout, state, supersets } = payload;

  // Totals
  let totalWeight = 0;
  let totalCardioDist = 0;
  let totalCardioTime = 0;
  let hasStrength = false;
  let hasCardio = false;

  // Per-exercise totals...
  const perExercise: Record<
    string,
    {
      kind: "strength" | "cardio";
      weight?: number;
      dist?: number;
      time?: number;
    }
  > = {};

  for (const we of workout.workout_exercises) {
    const exState = state.byWeId[we.id];
    if (!exState) continue;

    if (exState.kind === "strength") {
      const drop = (exState as any).dropMode;
      const w = exState.sets.reduce(
        (acc, st) => acc + sumStrengthSet(st, drop),
        0
      );
      if (w > 0) hasStrength = true;
      totalWeight += w;
      perExercise[we.id] = { kind: "strength", weight: w };
    } else {
      const agg = exState.sets.reduce(
        (acc, st) => {
          const { dist, time } = sumCardioSet(st);
          return { dist: acc.dist + dist, time: acc.time + time };
        },
        { dist: 0, time: 0 }
      );
      if (agg.dist > 0 || agg.time > 0) hasCardio = true;
      totalCardioDist += agg.dist;
      totalCardioTime += agg.time;
      perExercise[we.id] = { kind: "cardio", dist: agg.dist, time: agg.time };
    }
  }

  const durationStr = secondsToHMS(totalSec);

  // Header
  const Header = () => (
    <View style={styles.header}>
      <Pressable
        onPress={() => {
          Alert.alert("Discard Review?", "Go back to workout without saving?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Back",
              style: "destructive",
              onPress: () => {
                clearReviewPayload();
                router.back();
              },
            },
          ]);
        }}
        hitSlop={8}
        style={{ paddingHorizontal: 6, paddingVertical: 2 }}
      >
        <Text style={{ color: colors.danger, fontSize: 20, fontWeight: "800" }}>
          ✕
        </Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={styles.title} numberOfLines={2}>
          {workout.title ?? "Workout Review"}
        </Text>
        <Text style={styles.subtle}>Summary</Text>
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

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Summary cards */}
        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{durationStr}</Text>
            {!!bonusSec && (
              <Text style={styles.mutedSmall}>
                Includes bonus (+{secondsToHMS(bonusSec)} cardio)
              </Text>
            )}
          </View>

          {hasStrength && (
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Weight</Text>
              <Text style={styles.metricValue}>
                {Math.round(totalWeight)} kg
              </Text>
              <Text style={styles.mutedSmall}>All strength sets</Text>
            </View>
          )}

          {hasCardio && (
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Distance</Text>
              <Text style={styles.metricValue}>
                {totalCardioDist.toFixed(2)} km
              </Text>
              <Text style={styles.mutedSmall}>
                Cardio time {secondsToHMS(totalCardioTime)}
              </Text>
            </View>
          )}
        </View>

        {/* Exercises */}
        <View style={{ marginTop: 10, gap: 12 }}>
          {workout.workout_exercises.map((we, idx) => {
            const exState = state.byWeId[we.id];
            if (!exState) return null;

            const sup =
              we.superset_group && supersets.labels[we.superset_group]
                ? `Superset ${supersets.labels[we.superset_group]}`
                : null;

            const exTotals = perExercise[we.id];

            return (
              <View key={we.id} style={styles.exCard}>
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
                      {we.exercises?.name ?? "Exercise"}
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

                  {exTotals?.kind === "strength" ? (
                    <Text style={[styles.h3, { color: colors.primaryText }]}>
                      {Math.round(exTotals.weight || 0)} kg
                    </Text>
                  ) : (
                    <Text style={[styles.h3, { color: colors.primaryText }]}>
                      {(exTotals?.dist || 0).toFixed(2)} km
                    </Text>
                  )}
                </View>

                {/* Sets list */}
                <View style={{ marginTop: 10, gap: 6 }}>
                  {exState.kind === "strength"
                    ? exState.sets.map((st, i) => {
                        const isDrop = !!(exState as any).dropMode;
                        return (
                          <View key={i} style={styles.setRow}>
                            <Text
                              style={[
                                styles.setIndex,
                                { color: colors.subtle },
                              ]}
                            >
                              Set {i + 1}
                            </Text>
                            {isDrop ? (
                              <Text style={styles.setText}>
                                {(st.drops ?? [])
                                  .map((d) => `${n(d.reps)}×${n(d.weight)}`)
                                  .join(" → ")}{" "}
                                kg
                              </Text>
                            ) : (
                              <Text style={styles.setText}>
                                {n(st.reps)} × {n(st.weight)} kg
                              </Text>
                            )}
                          </View>
                        );
                      })
                    : exState.sets.map((st, i) => (
                        <View key={i} style={styles.setRow}>
                          <Text
                            style={[styles.setIndex, { color: colors.subtle }]}
                          >
                            Set {i + 1}
                          </Text>
                          <Text style={styles.setText}>
                            {n(st.distance).toFixed(2)} km •{" "}
                            {secondsToHMS(n(st.timeSec))}
                          </Text>
                        </View>
                      ))}
                </View>

                {/* Exercise notes */}
                {exState.notes ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.muted, { marginBottom: 2 }]}>
                      Notes
                    </Text>
                    <Text style={styles.noteBubble}>
                      {(exState as any).notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Workout notes */}
        {state.workoutNotes ? (
          <View style={[styles.exCard, { marginTop: 6 }]}>
            <Text style={styles.h3}>Workout Notes</Text>
            <Text style={[styles.noteBubble, { marginTop: 6 }]}>
              {state.workoutNotes}
            </Text>
          </View>
        ) : null}

        {/* Save */}
        <View style={{ height: 16 }} />
        <Pressable
          disabled={saving}
          onPress={async () => {
            // ✅ payload missing is a real issue (not auth)
            if (!payload) {
              Alert.alert(
                "Nothing to save",
                "Your workout data isn't ready yet."
              );
              return;
            }

            try {
              setSaving(true);

              // ✅ Ask Supabase for the session *right now* (avoids session flicker)
              const uid = await requireUserId();

              await saveCompletedWorkout({
                userId: uid,
                payload,
                totalDurationSec: totalSec,
                completedAt: new Date(),
                planWorkoutIdToComplete: planWorkoutId,
              });

              // best-effort extras (don’t block success)
              try {
                await bumpWeeklyCompleted(uid);
              } catch (e) {
                console.warn("bumpWeeklyCompleted failed:", e);
              }

              try {
                const { error } = await supabase.rpc(
                  "check_and_award_achievements",
                  {
                    p_user_id: uid,
                  }
                );
                if (error) console.warn("award achievements error:", error);
              } catch (e) {
                console.warn("award achievements threw:", e);
              }

              clearReviewPayload();
              Alert.alert("Saved", "Your workout has been saved.", [
                {
                  text: "OK",
                  onPress: () => router.replace("/(tabs)/workout"),
                },
              ]);
            } catch (e: any) {
              const msg = String(e?.message ?? "");

              // ✅ Clearer UX: session problems are not “random logout”
              if (msg === "auth_missing" || msg === "auth_session_error") {
                Alert.alert(
                  "Session expired",
                  "Please log in again to save your workout."
                );
                return;
              }

              // ✅ Clearer UX: gym signal issues
              const lower = msg.toLowerCase();
              if (
                lower.includes("network request failed") ||
                lower.includes("failed to fetch") ||
                lower.includes("timeout")
              ) {
                Alert.alert(
                  "No connection",
                  "Couldn't reach the server. Check your signal and try again."
                );
                return;
              }

              Alert.alert("Save failed", msg || "Something went wrong.");
            } finally {
              setSaving(false);
            }
          }}
          style={[
            styles.saveBtn,
            {
              backgroundColor: saving ? colors.border : colors.primaryBg,
              borderColor: colors.border,
              opacity: saving ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
            {saving ? "Saving…" : "Save Workout"}
          </Text>
        </Pressable>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
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

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
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

    saveBtn: {
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },
  });
