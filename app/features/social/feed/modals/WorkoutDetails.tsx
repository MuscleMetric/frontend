// app/features/social/feed/modals/WorkoutDetails.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { WorkoutDetailsPayload } from "./types";
import { fmtTs, fmtInt } from "../utils/format";

export function WorkoutDetails({
  loading,
  data,
}: {
  loading: boolean;
  data: WorkoutDetailsPayload | null;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginTop: layout.space.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          overflow: "hidden",
        },
        header: {
          padding: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        sub: {
          marginTop: 4,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },

        block: { padding: layout.space.md, gap: 10 },

        exTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        setLine: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },

        hint: {
          padding: layout.space.md,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          textAlign: "center",
        },
      }),
    [colors, typography, layout]
  );

  if (loading) {
    return (
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Workout details</Text>
          <Text style={styles.sub}>Loading…</Text>
        </View>
        <Text style={styles.hint}>Fetching sets and exercises…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Workout details</Text>
          <Text style={styles.sub}>Not available</Text>
        </View>
        <Text style={styles.hint}>No workout details for this post.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout details</Text>
        <Text style={styles.sub}>
          {data.completed_at ? fmtTs(data.completed_at) : "—"}
        </Text>
      </View>

      <View style={styles.block}>
        {data.exercises.map((ex) => (
          <View key={ex.workout_exercise_history_id}>
            <Text style={styles.exTitle}>
              {(ex.exercise_name ?? "Exercise").toUpperCase()}
            </Text>

            {ex.sets.map((s) => (
              <Text key={s.id} style={styles.setLine}>
                Set {s.set_index ?? "—"} • {fmtInt(s.weight ?? 0)} kg ×{" "}
                {fmtInt(s.reps ?? 0)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}