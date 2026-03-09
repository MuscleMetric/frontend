// app/features/social/create/editWorkoutPost/WorkoutPostPreviewCard.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { WorkoutSelection } from "../state/createPostTypes";
import { formatNumber } from "../shared/formatters";
import { WorkoutCover } from "@/ui/media/WorkoutCover";
import { UserMetaRow } from "../../feed/components/UserMetaRow";

type Props = {
  workout: WorkoutSelection;
  caption?: string;

  viewerName: string;
  viewerUsername?: string | null;

  containerStyle?: ViewStyle;
};

function upperOrFallback(s?: string | null, fallback = "WORKOUT") {
  const v = (s ?? "").trim();
  return v.length ? v.toUpperCase() : fallback;
}

export default function WorkoutPostPreviewCard({
  workout,
  caption,
  viewerName,
  viewerUsername,
  containerStyle,
}: Props) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl ?? layout.radius.lg,
          overflow: "hidden",
        },

        headerPad: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
          paddingBottom: layout.space.md,
        },

        bannerWrap: {
          paddingHorizontal: layout.space.lg,
          paddingBottom: layout.space.md,
        },

        workoutWrap: {
          paddingBottom: layout.space.md,
        },

        statsPill: {
          marginTop: layout.space.md,
          marginHorizontal: layout.space.lg,
          marginBottom: layout.space.md,
          borderRadius: 999,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },

        statCol: {
          flex: 1,
          alignItems: "center",
        },

        divider: {
          width: 1,
          alignSelf: "stretch",
          backgroundColor: colors.border,
          opacity: 0.8,
        },

        statLabel: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          textTransform: "uppercase",
          marginBottom: 4,
        },

        statValueRow: {
          flexDirection: "row",
          alignItems: "baseline",
          gap: 6,
        },

        statValue: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 18,
        },

        unit: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        caption: {
          marginHorizontal: layout.space.lg,
          marginTop: layout.space.sm,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          textAlign: "center",
        },
      }),
    [colors, typography, layout]
  );

  const imageKey = (workout as any).imageKey ?? null;
  const workoutTitle = upperOrFallback(workout.title);

  const volume = formatNumber(workout.totalVolume ?? 0);
  const sets = String(workout.totalSets ?? 0);
  const exercises = String(workout.topExercises?.length ?? 0);

  return (
    <View style={[styles.card, containerStyle]}>
      {/* 🔥 SAME META ROW AS FEED */}
      <View style={styles.headerPad}>
        <UserMetaRow
          name={viewerName}
          username={viewerUsername}
          createdAt={new Date().toISOString()} // preview uses "now"
        />
      </View>

      <View style={styles.workoutWrap}>
        {/* BANNER */}
        <View style={styles.bannerWrap}>
          <WorkoutCover
            imageKey={imageKey}
            title={workoutTitle}
            variant="banner"
            height={190}
            focusY={0.42}
            zoom={1.05}
            radius={layout.radius.lg}
          />
        </View>

        {/* STATS */}
        <View style={styles.statsPill}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>VOLUME</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{volume}</Text>
              <Text style={styles.unit}>{workout.volumeUnit ?? "kg"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statCol}>
            <Text style={styles.statLabel}>SETS</Text>
            <Text style={styles.statValue}>{sets}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statCol}>
            <Text style={styles.statLabel}>EXERCISES</Text>
            <Text style={styles.statValue}>{exercises}</Text>
          </View>
        </View>

        {!!caption?.trim() && (
          <Text style={styles.caption}>{caption.trim()}</Text>
        )}
      </View>
    </View>
  );
}