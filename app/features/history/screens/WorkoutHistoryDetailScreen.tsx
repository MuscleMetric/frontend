// app/features/history/screens/WorkoutHistoryDetailScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/lib/useAppTheme";
import { Screen, ScreenHeader, Card, LoadingScreen, ErrorState, Icon } from "@/ui";

import { HistorySectionHeader } from "../ui/HistorySectionHeader";
import { PRBadge } from "../ui/PRBadge";
import { WorkoutHistoryExerciseRow } from "../ui/WorkoutHistoryExerciseRow";

/** ✅ Change these to your real RPC names if different */
const RPC_WORKOUT_HISTORY_DETAIL = "get_workout_history_detail"; // (p_workout_history_id uuid)

/** payload shape (keep it permissive, safe optional chaining) */
type DetailPayload = {
  meta?: { generated_at?: string; timezone?: string; unit?: "kg" };
  session?: {
    workout_history_id: string;
    workout_id?: string | null;
    title: string;
    completed_at: string;
    duration_seconds?: number | null;
    notes?: string | null;

    // optional: if you compute them
    total_volume?: number | null;
    pr_count?: number | null;
  };

  exercises?: Array<{
    exercise_id: string;
    exercise_name: string;
    summary?: string | null; // e.g. "4 sets · top 80×6"
    is_pr?: boolean | null;

    sets?: Array<{
      set_number: number;
      reps?: number | null;
      weight?: number | null;
      time_seconds?: number | null;
      distance?: number | null;
      e1rm?: number | null;
      is_pr?: boolean | null; // optional per-set PR marker
    }>;
  }>;
};

function fmtDayTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function fmtMins(sec?: number | null) {
  if (!sec || !isFinite(sec)) return "—";
  return `${Math.max(1, Math.round(sec / 60))}m`;
}

function n0(x?: number | null) {
  if (x == null || !isFinite(x)) return "—";
  return String(Math.round(x));
}

export default function WorkoutHistoryDetailScreen() {
  const { colors, typography, layout } = useAppTheme();

  const params = useLocalSearchParams<{ workoutHistoryId?: string }>();
  const workoutHistoryId = useMemo(
    () => (params.workoutHistoryId ?? "").toString(),
    [params.workoutHistoryId]
  );

  const [data, setData] = useState<DetailPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  if (loading) return <LoadingScreen />;
  if (err) return <ErrorState title="Workout detail failed" message={err} />;
  if (!data?.session) return <ErrorState title="No session" message="Try another workout." />;

  const s = data.session;
  const exercises = data.exercises ?? [];

  return (
    <Screen>
      <ScreenHeader
        title="Workout"
        right={<Icon name="bar-chart-outline" size={20} color={colors.textMuted} />}
      />

      <ScrollView
        contentContainerStyle={{ padding: layout.space.lg, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        <HistorySectionHeader
          title={s.title}
          subtitle={fmtDayTime(s.completed_at)}
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
                {fmtMins(s.duration_seconds)}
              </Text>
            </View>
          }
        />

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
              {n0(s.total_volume)}
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
              {n0(s.pr_count)}
            </Text>
          </Card>
        </View>

        {s.notes ? (
          <Card style={{ padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, letterSpacing: 0.8 }}>
              NOTES
            </Text>
            <Text style={{ color: colors.text, marginTop: 8, fontSize: 14 }}>
              {s.notes}
            </Text>
          </Card>
        ) : null}

        {/* Exercises */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
            Exercises
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            PRs in this session are highlighted.
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
                  {ex.is_pr ? <PRBadge /> : null}
                </View>

                {ex.summary ? (
                  <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                    {ex.summary}
                  </Text>
                ) : null}

                {/* sets (simple table style) */}
                {ex.sets?.length ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {ex.sets.map((st) => (
                      <WorkoutHistoryExerciseRow
                        key={`${ex.exercise_id}-${st.set_number}`}
                        name={`Set ${st.set_number}`}
                        summary={
                          st.weight != null && st.reps != null
                            ? `${st.weight} × ${st.reps}`
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
      </ScrollView>
    </Screen>
  );
}
