// app/features/history/screens/WorkoutHistoryListScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TextInput } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/lib/useAppTheme";
import {
  Screen,
  ScreenHeader,
  Card,
  LoadingScreen,
  ErrorState,
  Button,
  Icon,
  ListRow,
} from "@/ui";

import { HistorySectionHeader } from "../ui/HistorySectionHeader";
import { HistoryEmptyState } from "../ui/HistoryEmptyState";

/** ✅ Change these to your real RPC names if different */
const RPC_WORKOUT_HISTORY_LIST = "get_workout_history_feed"; // returns grouped list
// Expected: { groups: [{ key, title, items: [...] }], meta?: {...} }

type HistoryListItem = {
  workout_history_id: string;
  workout_id?: string | null;
  title: string;
  completed_at: string;
  duration_seconds?: number | null;
  workout_image_key?: string | null;

  // optional, if you return it
  insight?: { label: string; trend?: "up" | "down" | "flat" } | null;
};

type HistoryGroup = {
  key: string; // e.g. "2026-01" or "2026-W03" or "2026-01-23"
  title: string; // e.g. "JAN 2026"
  items: HistoryListItem[];
};

type HistoryListPayload = {
  groups: HistoryGroup[];
  meta?: { timezone?: string; generated_at?: string };
};

function fmtDay(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtMins(sec?: number | null) {
  if (!sec || !isFinite(sec)) return undefined;
  return `${Math.max(1, Math.round(sec / 60))}m`;
}

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

    const { data: res, error } = await supabase.rpc(RPC_WORKOUT_HISTORY_LIST);

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

  const groups: HistoryGroup[] = (data?.groups ?? []) as any;

  const filteredGroups = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;

    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => it.title.toLowerCase().includes(s)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  if (loading) return <LoadingScreen />;
  if (err) return <ErrorState title="History failed" message={err} />;

  const hasAny = groups.length > 0 && groups.some((g) => g.items.length > 0);

  return (
    <Screen>
      <ScreenHeader
        title="History"
        right={<Icon name="stats-chart-outline" size={20} color={colors.textMuted} />}
      />

      <ScrollView
        contentContainerStyle={{ padding: layout.space.lg, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />
        }
      >
        {/* header + search */}
        <HistorySectionHeader
          title="Workout history"
          subtitle="Review sessions, spot PRs, and track consistency."
          right={
            <Button
              title="Back"
              variant="secondary"
              fullWidth={false}
              onPress={() => router.back()}
            />
          }
        />

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search workouts"
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
            onStartWorkout={() => {
              // tweak this route to your start-workout entry
              router.push("/(tabs)/workout");
            }}
          />
        ) : (
          filteredGroups.map((g) => (
            <View key={g.key} style={{ marginTop: 2 }}>
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

              <Card style={{ padding: 8, borderRadius: 18 }}>
                {g.items.map((it) => (
                  <View key={it.workout_history_id}>
                    <ListRow
                      title={it.title}
                      subtitle={fmtDay(it.completed_at)}
                      rightText={fmtMins(it.duration_seconds)}
                      onPress={() =>
                        router.push({
                          pathname: "/history/screens/WorkoutHistoryDetailScreen",
                          params: { workoutHistoryId: it.workout_history_id },
                        } as any)
                      }
                    />
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
