import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ListRow, Pill, Button } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function fmtRelative(iso: string) {
  try {
    const d = new Date(iso).getTime();
    const now = Date.now();
    const s = Math.max(0, Math.floor((now - d) / 1000));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const day = Math.floor(h / 24);
    if (day > 0) return `${day}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return "Just now";
  } catch {
    return "";
  }
}

function fmtDuration(seconds?: number | null) {
  const s = Number(seconds ?? 0);
  if (!Number.isFinite(s) || s <= 0) return null;
  const mins = Math.round(s / 60);
  return `${mins} min`;
}

function fmtNumber(n: number) {
  try {
    return new Intl.NumberFormat("en-GB").format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

export default function RecentHistoryCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();
  const rows = data.recent_history ?? [];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: layout.space.sm,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        headerRight: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.sm,
        },

        emptyWrap: { gap: layout.space.md },
        emptyText: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },

        listGap: { gap: layout.space.sm },
        footer: { marginTop: layout.space.md },
      }),
    [colors, typography, layout]
  );

  const goAll = () => router.push("/features/history/screens/WorkoutHistoryListScreen");

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Recent History</Text>

        {rows.length > 0 ? (
          <View style={styles.headerRight}>
            <Pill tone="neutral" label={`${Math.min(rows.length, 3)} shown`} />
            <Pressable onPress={goAll}>
              <Pill tone="primary" label="View all" />
            </Pressable>
          </View>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            Your fitness journey starts here. Complete a workout to see it show up
            here.
          </Text>
          <Button title="Find a workout" onPress={() => router.push("/(tabs)/workout")} />
        </View>
      ) : (
        <>
          <View style={styles.listGap}>
            {rows.slice(0, 3).map((r) => {
              const dur = fmtDuration(r.duration_seconds);
              const rightTop = fmtRelative(r.completed_at);

              const subtitleBits = [
                r.volume != null ? `Volume: ${fmtNumber(r.volume)}kg` : null,
                dur ? `Duration: ${dur}` : null,
              ].filter(Boolean);

              return (
                <ListRow
                  key={r.workout_history_id}
                  title={r.workout_title ?? "Workout"}
                  subtitle={subtitleBits.join(" · ")}
                  rightText={rightTop}
                  onPress={() =>
                    router.push({
                      pathname: "/features/history/screens/WorkoutHistoryDetailScreen",
                      params: { workoutHistoryId: r.workout_history_id },
                    })
                  }
                />
              );
            })}
          </View>

          <View style={styles.footer}>
            <Button variant="secondary" title="View all history" onPress={goAll} />
          </View>
        </>
      )}
    </Card>
  );
}
