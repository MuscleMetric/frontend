import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { WorkoutDetailsPayload } from "./types";
import { fmtTs, fmtInt } from "../utils/format";

function formatSetLine(s: {
  weight?: number | null;
  reps?: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
}) {
  const hasWeight = typeof s.weight === "number" && Number.isFinite(s.weight);
  const hasReps = typeof s.reps === "number" && Number.isFinite(s.reps);
  const hasDuration =
    typeof s.duration_seconds === "number" &&
    Number.isFinite(s.duration_seconds);
  const hasDistance =
    typeof s.distance_m === "number" && Number.isFinite(s.distance_m);

  if (hasWeight && hasReps) {
    return `${fmtInt(s.weight ?? 0)} kg × ${fmtInt(s.reps ?? 0)}`;
  }

  if (hasReps) {
    return `${fmtInt(s.reps ?? 0)} reps`;
  }

  if (hasDuration && hasDistance) {
    return `${fmtInt(s.duration_seconds ?? 0)} sec • ${fmtInt(s.distance_m ?? 0)} m`;
  }

  if (hasDuration) {
    return `${fmtInt(s.duration_seconds ?? 0)} sec`;
  }

  if (hasDistance) {
    return `${fmtInt(s.distance_m ?? 0)} m`;
  }

  return "Logged set";
}

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
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl ?? layout.radius.lg,
          overflow: "hidden",
        },

        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
          paddingBottom: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          gap: 4,
        },

        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
        },

        sub: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        statsRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.bg,
        },

        stat: {
          flex: 1,
          alignItems: "center",
        },

        statLabel: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          textTransform: "uppercase",
          marginBottom: 4,
        },

        statValue: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        divider: {
          width: 1,
          alignSelf: "stretch",
          backgroundColor: colors.border,
          opacity: 0.8,
        },

        body: {
          padding: layout.space.lg,
          gap: layout.space.md,
        },

        exerciseCard: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.lg,
          padding: layout.space.md,
          gap: layout.space.sm,
        },

        exTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        setsWrap: {
          gap: 6,
        },

        setRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },

        setIndex: {
          minWidth: 44,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        setLine: {
          flex: 1,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        hint: {
          padding: layout.space.lg,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          textAlign: "center",
        },
      }),
    [colors, typography, layout],
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

  const exercisesCount = Array.isArray(data.exercises) ? data.exercises.length : 0;
  const setsCount = Array.isArray(data.exercises)
    ? data.exercises.reduce(
        (sum, ex) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0),
        0,
      )
    : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {data.workout_title ?? "Workout details"}
        </Text>
        <Text style={styles.sub}>
          {data.completed_at ? fmtTs(data.completed_at) : "—"}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Exercises</Text>
          <Text style={styles.statValue}>{fmtInt(exercisesCount)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <Text style={styles.statLabel}>Sets</Text>
          <Text style={styles.statValue}>{fmtInt(setsCount)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>
            {data.duration_seconds != null
              ? `${fmtInt(Math.round(data.duration_seconds / 60))} min`
              : "—"}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {data.exercises.map((ex) => (
          <View key={ex.workout_exercise_history_id} style={styles.exerciseCard}>
            <Text style={styles.exTitle}>
              {ex.exercise_name ?? "Exercise"}
            </Text>

            <View style={styles.setsWrap}>
              {ex.sets.map((s) => (
                <View key={s.id} style={styles.setRow}>
                  <Text style={styles.setIndex}>
                    Set {s.set_index ?? "—"}
                  </Text>
                  <Text style={styles.setLine}>{formatSetLine(s)}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}