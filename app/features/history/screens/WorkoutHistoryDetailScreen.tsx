import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/lib/useAppTheme";
import { Screen, ScreenHeader, Card, LoadingScreen, ErrorState, Icon } from "@/ui";

import { HistorySectionHeader } from "../ui/HistorySectionHeader";
import { PRBadge } from "../ui/PRBadge";
import { WorkoutHistoryExerciseRow } from "../ui/WorkoutHistoryExerciseRow";

// ✅ Share sheet
import { ShareWorkoutSheet } from "../share/ShareWorkoutSheet";
import type { ShareWorkoutData } from "../share/workoutShare";

const RPC_WORKOUT_HISTORY_DETAIL = "get_workout_history_detail";

type Insight = {
  metric?: "volume" | string;
  trend?: "up" | "down" | "flat";
  delta_pct?: number | null;
  label?: string;
} | null;

type DetailPayload = {
  meta?: { timezone?: string; unit?: "kg" };

  header?: {
    workout_history_id: string;
    workout_id?: string | null;
    title: string;
    completed_at: string;
    notes?: string | null;
  };

  stats?: {
    duration_seconds?: number | null;
    sets_count?: number | null;
    volume_kg?: number | null;
    insight?: Insight;
  };

  prs?: Array<{
    exercise_id: string;
    exercise_name: string;
    e1rm?: number | null;
    weight_kg?: number | null;
    reps?: number | null;
    delta_abs?: number | null;
    delta_pct?: number | null;
  }>;

  exercises?: Array<{
    exercise_id: string;
    exercise_name: string;
    order_index?: number | null;
    is_pr?: boolean | null;
    sets?: Array<{
      set_id?: string;
      set_number: number;
      reps?: number | null;
      weight_kg?: number | null;
      e1rm?: number | null;
      is_best?: boolean | null;
      is_pr?: boolean | null;
    }>;
  }>;
};

function fmtDayTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

function fmtMins(sec?: number | null) {
  if (!sec || !isFinite(sec)) return "—";
  return `${Math.max(1, Math.round(sec / 60))}m`;
}

function n0(x?: number | null) {
  if (x == null || !isFinite(x)) return "—";
  return String(Math.round(x));
}

function fmtKg(x?: number | null) {
  if (x == null || !isFinite(x)) return "—";
  return `${Math.round(x)}`;
}

export default function WorkoutHistoryDetailScreen({
  workoutHistoryId: workoutHistoryIdProp,
}: {
  workoutHistoryId?: string;
} = {}) {
  const { colors, typography, layout } = useAppTheme();
  const params = useLocalSearchParams<{ workoutHistoryId?: string }>();

  const workoutHistoryId = useMemo(
    () => (workoutHistoryIdProp ?? params.workoutHistoryId ?? "").toString(),
    [workoutHistoryIdProp, params.workoutHistoryId]
  );

  const [data, setData] = useState<DetailPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Share UI state
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!workoutHistoryId) {
        setErr("Missing workoutHistoryId");
        setData(null);
        setLoading(false);
        return;
      }

      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      setErr(null);

      const { data: res, error } = await supabase.rpc(RPC_WORKOUT_HISTORY_DETAIL, {
        p_workout_history_id: workoutHistoryId,
      });

      if (error) {
        setErr(error.message);
        setData(null);
      } else {
        setData(res as any);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [workoutHistoryId]
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  // ✅ SAFE derived values (defined BEFORE early returns)
  const header = data?.header ?? null;
  const stats = data?.stats ?? null;
  const insight = stats?.insight ?? null;
  const exercises = data?.exercises ?? [];
  const prs = data?.prs ?? [];
  const prsCount = prs.length;

  // ✅ Build share data (HOOK ALWAYS RUNS)
  const shareData: ShareWorkoutData = useMemo(() => {
    if (!header) {
      return {
        title: "",
        dateLabel: "",
        durationLabel: "",
        totalSets: null,
        totalVolumeKg: null,
        exercises: [],
        prs: [],
      };
    }

    const dateLabel = fmtDayTime(header.completed_at);
    const durationLabel = fmtMins(stats?.duration_seconds);

    return {
      title: header.title ?? "Workout",
      dateLabel,
      durationLabel,
      totalSets: stats?.sets_count ?? null,
      totalVolumeKg: stats?.volume_kg ?? null,

      exercises: exercises.map((ex) => ({
        name: ex.exercise_name,
        sets: (ex.sets ?? []).map((s) => ({
          setNumber: s.set_number,
          weightKg: s.weight_kg ?? null,
          reps: s.reps ?? null,
        })),
      })),

      // PRs already include the set data that caused the PR (weight_kg + reps)
      prs: prs.map((p) => ({
        exerciseName: p.exercise_name,
        weightKg: p.weight_kg ?? null,
        reps: p.reps ?? null,
        e1rm: p.e1rm ?? null,
      })),
    };
  }, [header, stats?.duration_seconds, stats?.sets_count, stats?.volume_kg, exercises, prs]);

  // ✅ EARLY RETURNS AFTER ALL HOOKS
  if (loading) return <LoadingScreen />;
  if (err) return <ErrorState title="Workout detail failed" message={err} />;
  if (!header) return <ErrorState title="No session" message="Try another workout." />;

  return (
    <Screen>
      <ScreenHeader
        title="Workout"
        right={
          <Pressable
            onPress={() => {
              if (!shareData.title) {
                Alert.alert("Share unavailable", "Missing share data.");
                return;
              }
              setShareOpen(true);
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 6 }]}
            hitSlop={10}
          >
            <Icon name="share-outline" size={20} color={colors.textMuted} />
          </Pressable>
        }
      />

      {/* ✅ Share sheet mounted here */}
      <ShareWorkoutSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        data={shareData}
        shareUrl={null}
      />

      <ScrollView
        contentContainerStyle={{
          padding: layout.space.lg,
          paddingBottom: 24,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        <HistorySectionHeader
          title={header.title}
          subtitle={fmtDayTime(header.completed_at)}
          right={
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>
                {fmtMins(stats?.duration_seconds)}
              </Text>
            </View>
          }
        />

        {/* ✅ Insight line */}
        {insight?.label ? (
          <Text style={{ color: colors.textMuted, marginTop: -6 }}>{insight.label}</Text>
        ) : null}

        {/* Summary strip */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>VOLUME</Text>
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fontFamily.bold,
                fontSize: 20,
                marginTop: 6,
              }}
            >
              {fmtKg(stats?.volume_kg)} kg
            </Text>
          </Card>

          <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>PRS</Text>
            <Text
              style={{
                color: colors.success,
                fontFamily: typography.fontFamily.bold,
                fontSize: 20,
                marginTop: 6,
              }}
            >
              {n0(prsCount)}
            </Text>
          </Card>
        </View>

        {header.notes ? (
          <Card style={{ padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, letterSpacing: 0.8 }}>
              NOTES
            </Text>
            <Text style={{ color: colors.text, marginTop: 8, fontSize: 14 }}>
              {header.notes}
            </Text>
          </Card>
        ) : null}

        {/* Exercises */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
            Exercises
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            PR pills only show when you broke your previous best.
          </Text>

          <View style={{ marginTop: 12, gap: 14 }}>
            {exercises.map((ex) => (
              <View key={ex.exercise_id}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontFamily: typography.fontFamily.bold,
                      fontSize: 16,
                    }}
                  >
                    {ex.exercise_name}
                  </Text>

                  {/* Optional: exercise-level PR badge if you return ex.is_pr */}
                  {ex.is_pr ? <PRBadge /> : null}
                </View>

                {ex.sets?.length ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {ex.sets.map((st) => (
                      <WorkoutHistoryExerciseRow
                        key={`${ex.exercise_id}-${st.set_number}-${st.set_id ?? "x"}`}
                        name={`Set ${st.set_number}`}
                        summary={
                          st.weight_kg != null && st.reps != null
                            ? `${st.weight_kg} × ${st.reps}`
                            : st.reps != null
                            ? `${st.reps} reps`
                            : "—"
                        }
                        isPr={!!st.is_pr}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </Card>

        {/* PR list */}
        {prsCount > 0 ? (
          <Card style={{ padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
              PRs
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 6 }}>
              New bests from this session.
            </Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {prs.slice(0, 12).map((p) => (
                <View key={p.exercise_id} style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ flex: 1, color: colors.text }} numberOfLines={1}>
                    {p.exercise_name}
                  </Text>

                  <Text style={{ color: colors.textMuted, marginRight: 10 }}>
                    {p.weight_kg != null && p.reps != null ? `${p.weight_kg} × ${p.reps}` : ""}
                  </Text>

                  <PRBadge />
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
