// app/features/history/index.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

type WorkoutHistoryRow = {
  id: string;
  completed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  workouts: { id: string; title: string | null } | null;
};

type SetJoinRow = {
  reps: number | null;
  weight: number | null;
  workout_exercise_history: {
    workout_history_id: string;
    exercise_id: string;
    exercises: { id: string; name: string };
  };
};

const PAGE_SIZE = 10;

export default function WorkoutHistoryList() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutHistoryRow[]>([]);
  const [setsMap, setSetsMap] = useState<Record<string, any[]>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchWorkouts = useCallback(
    async (pageNum: number, replace = false) => {
      if (!userId) return;
      if (pageNum > 0) setLoadingMore(true);
      else setLoading(true);
      try {
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data: wh, error } = await supabase
          .from("workout_history")
          .select(
            `
          id,
          completed_at,
          duration_seconds,
          notes,
          workouts:workouts(id, title)
        `
          )
          .eq("user_id", userId)
          .order("completed_at", { ascending: false })
          .range(from, to)
          .returns<WorkoutHistoryRow[]>();

        if (error) throw error;
        if (!wh?.length) setHasMore(false);

        setWorkouts((prev) => (replace ? wh ?? [] : [...prev, ...(wh ?? [])]));

        // load mini summaries for the new workouts
        const ids = (wh ?? []).map((r) => r.id);
        if (ids.length) {
          const { data: sets, error: e2 } = await supabase
            .from("workout_set_history")
            .select(
              `
            reps,
            weight,
            workout_exercise_history:workout_exercise_history!inner(
              workout_history_id,
              exercise_id,
              exercises:exercises!inner(id, name)
            )
          `
            )
            .in("workout_exercise_history.workout_history_id", ids)
            .returns<SetJoinRow[]>();
          if (e2) throw e2;

          const grouped: Record<
            string,
            Record<string, { name: string; sets: number; reps?: number }>
          > = {};
          for (const row of sets ?? []) {
            const hid = row.workout_exercise_history.workout_history_id;
            const exId = row.workout_exercise_history.exercise_id;
            const name = row.workout_exercise_history.exercises.name;
            grouped[hid] ||= {};
            grouped[hid][exId] ||= { name, sets: 0, reps: undefined };
            grouped[hid][exId].sets += 1;
            if (row.reps != null) grouped[hid][exId].reps = row.reps;
          }
          setSetsMap((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(grouped).map(([hid, dict]) => [
                hid,
                Object.values(dict),
              ])
            ),
          }));
        }
      } catch (e) {
        console.error("fetchWorkouts error:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchWorkouts(0, true);
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    setHasMore(true);
    setPage(0);
    await fetchWorkouts(0, true);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    await fetchWorkouts(next);
  };

  const fmtDuration = (sec?: number | null) => {
    if (!sec) return null;
    const m = Math.round(sec / 60);
    return `${m}min`;
  };

  if (!userId)
    return (
      <View style={s.center}>
        <Text style={s.muted}>Sign in to view workout history.</Text>
      </View>
    );

  if (loading && workouts.length === 0)
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]} // keep bottom free for share sheets/home indicator
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ padding: 16, gap: 12 }}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const bottom =
            nativeEvent.contentOffset.y +
              nativeEvent.layoutMeasurement.height >=
            nativeEvent.contentSize.height - 150;
          if (bottom) loadMore();
        }}
      >
        <View style={s.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="chevron-left" size={20} color={colors.primary} />
            <Text style={s.backText}>Back</Text>
          </Pressable>

          <Text style={s.headerTitle} numberOfLines={1}>
            Workout History
          </Text>

          {/* spacer to keep title centered */}
          <View style={{ width: 64 }} />
        </View>

        {workouts.map((w) => {
          const items = setsMap[w.id] ?? [];
          return (
            <Pressable
              key={w.id}
              onPress={() =>
                router.push({
                  pathname: "/features/history/detail",
                  params: { id: w.id },
                })
              }
              style={[s.card]}
            >
              <View style={[s.rowBetween, { marginBottom: 6 }]}>
                <Text style={s.muted}>
                  {new Date(w.completed_at).toLocaleDateString()}
                </Text>
                {w.duration_seconds ? (
                  <Text style={s.muted}>{fmtDuration(w.duration_seconds)}</Text>
                ) : null}
              </View>

              <Text style={s.title}>{w.workouts?.title ?? "Workout"}</Text>
              <View style={{ height: 8 }} />

              {items.slice(0, 5).map((it, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <View style={s.dot} />
                  <Text style={s.itemText}>
                    {it.name} – {it.sets}x{it.reps ?? "?"}
                  </Text>
                </View>
              ))}

              {w.notes ? (
                <>
                  <View style={s.hr} />
                  <Text style={s.subhead}>Notes</Text>
                  <Text style={s.notes} numberOfLines={3}>
                    “{w.notes}”
                  </Text>
                </>
              ) : null}
            </Pressable>
          );
        })}

        {loadingMore ? (
          <ActivityIndicator style={{ marginVertical: 20 }} />
        ) : !hasMore ? (
          <Text style={[s.muted, { textAlign: "center", marginVertical: 12 }]}>
            All workouts loaded.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    h2: { fontSize: 20, fontWeight: "800", color: colors.text },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    muted: { color: colors.subtle },
    subhead: { color: colors.text, fontWeight: "700", marginTop: 6 },
    notes: { color: colors.subtle, fontStyle: "italic" },
    hr: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: 8,
    },
    itemText: { color: colors.text },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: "transparent",
    },
    backText: { color: colors.primary, fontWeight: "700" },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
  });
