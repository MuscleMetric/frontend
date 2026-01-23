import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/lib/useAppTheme";
import {
  Screen,
  ScreenHeader,
  LoadingScreen,
  ErrorState,
  Button,
  Icon,
} from "@/ui";

import { HistoryEmptyState } from "../ui/HistoryEmptyState";
import { WorkoutHistoryCard } from "../ui/WorkoutHistoryCard";

import { groupHistoryItems } from "../utils/history.grouping";
import type { HistoryGroup } from "../utils/history.grouping";

import type { HistoryListItem } from "../data/history.types";

/** RPC */
const RPC_WORKOUT_HISTORY_LIST = "get_workout_history_feed";

/**
 * IMPORTANT:
 * Your RPC returns: { meta: {...}, items: [...] }
 * not { groups: [...] }
 */

type HistoryListPayload = {
  meta?: { timezone?: string; generated_at?: string; unit?: "kg" };
  items: HistoryListItem[];
};

export default function WorkoutHistoryListScreen() {
  const { colors, typography, layout } = useAppTheme();

  const [data, setData] = useState<HistoryListPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState("");

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    setErr(null);

    // If you want search server-side later, pass p_query: q
    const { data: res, error } = await supabase.rpc(RPC_WORKOUT_HISTORY_LIST, {
      p_limit: 50,
      p_cursor_completed_at: null,
      p_cursor_id: null,
      p_query: null,
    });

    if (error) {
      setErr(error.message);
      setData(null);
    } else {
      setData(res as any);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  const items: HistoryListItem[] = useMemo(() => {
    return (data?.items ?? []) as HistoryListItem[];
  }, [data?.items]);

  // client-side search (matches your design UX)
  const filteredItems = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;

    return items.filter((it) => {
      const inTitle = it.title.toLowerCase().includes(s);
      const inExercises = (it.top_items ?? []).some((x) =>
        x.exercise_name.toLowerCase().includes(s)
      );
      return inTitle || inExercises;
    });
  }, [items, q]);

  const groups: HistoryGroup[] = useMemo(() => {
    return groupHistoryItems(filteredItems);
  }, [filteredItems]);

  if (loading) return <LoadingScreen />;
  if (err) return <ErrorState title="History failed" message={err} />;

  const hasAny = groups.length > 0 && groups.some((g) => g.items.length > 0);

  return (
    <Screen>
      <ScreenHeader
        title="History"
        right={<Icon name="time-outline" size={20} color={colors.textMuted} />}
      />

      <ScrollView
        contentContainerStyle={{
          padding: layout.space.lg,
          paddingBottom: 24,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
          />
        }
      >
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search workouts or exercises"
          placeholderTextColor={colors.textMuted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
          }}
        />

        {!hasAny ? (
          <HistoryEmptyState
            onStartWorkout={() => router.push("/(tabs)/workout")}
          />
        ) : (
          groups.map((g) => (
            <View key={g.key} style={{ marginTop: 6 }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  letterSpacing: 0.8,
                  fontFamily: typography.fontFamily.semibold,
                  marginBottom: 8,
                }}
              >
                {g.title}
              </Text>

              {/* one card per workout (matches design) */}
              <View style={{ gap: 12 }}>
                {g.items.map((it) => (
                  <WorkoutHistoryCard
                    key={it.workout_history_id}
                    w={{
                      workout_history_id: it.workout_history_id,
                      title: it.title,
                      completed_at: it.completed_at,
                      duration_seconds: it.duration_seconds,
                      pr_count: it.pr_count,
                      volume_kg: it.volume_kg,
                      top_items: it.top_items,
                      insight: it.insight as any,
                    }}
                    onPress={() =>
                      router.push({
                        pathname: "/features/progress/screens/historyDetail",
                        params: { workoutHistoryId: it.workout_history_id },
                      } as any)
                    }
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
