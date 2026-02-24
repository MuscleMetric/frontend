// app/features/social/create/editWorkoutPost/WorkoutPostPreviewCard.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ImageBackground } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { WorkoutSelection } from "../state/createPostTypes";
import {
  formatDateShort,
  formatDuration,
  formatNumber,
} from "../shared/formatters";

type Props = {
  workout: WorkoutSelection;
  caption?: string;
};

export default function WorkoutPostPreviewCard({ workout, caption }: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: 22,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        image: {
          width: "100%",
          minHeight: 240,
          padding: 16,
          justifyContent: "flex-end",
        },
        overlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.35)",
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        },
        title: {
          flex: 1,
          fontSize: typography.size.h2,
          fontWeight: "800",
          color: workout.imageUri ? "#fff" : colors.text,
          marginRight: 10,
        },
        date: {
          fontSize: typography.size.meta,
          color: workout.imageUri ? "rgba(255,255,255,0.85)" : colors.textMuted,
          fontWeight: "600",
        },
        statsGrid: {
          flexDirection: "row",
          gap: 10,
        },
        statBox: {
          flex: 1,
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: workout.imageUri
            ? "rgba(255,255,255,0.14)"
            : colors.surface,
          borderWidth: workout.imageUri ? 0 : 1,
          borderColor: colors.border,
        },
        statLabel: {
          fontSize: typography.size.meta,
          color: workout.imageUri ? "rgba(255,255,255,0.8)" : colors.textMuted,
          fontWeight: "600",
        },
        statValue: {
          marginTop: 4,
          fontSize: typography.size.h2,
          color: workout.imageUri ? "#fff" : colors.text,
          fontWeight: "900",
          letterSpacing: -0.3,
        },
        statValueSmall: {
          marginTop: 4,
          fontSize: typography.size.h3 ?? typography.size.body,
          color: workout.imageUri ? "#fff" : colors.text,
          fontWeight: "800",
          letterSpacing: -0.2,
        },
        listWrap: {
          marginTop: 12,
          borderRadius: 16,
          padding: 12,
          backgroundColor: workout.imageUri
            ? "rgba(255,255,255,0.12)"
            : colors.surface,
          borderWidth: workout.imageUri ? 0 : 1,
          borderColor: colors.border,
        },
        listTitle: {
          fontSize: typography.size.meta,
          color: workout.imageUri ? "rgba(255,255,255,0.8)" : colors.textMuted,
          fontWeight: "700",
          marginBottom: 8,
        },
        listItem: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 6,
        },
        listLeft: {
          fontSize: typography.size.body,
          color: workout.imageUri ? "#fff" : colors.text,
          fontWeight: "600",
          flex: 1,
          marginRight: 10,
        },
        listRight: {
          fontSize: typography.size.body,
          color: workout.imageUri ? "rgba(255,255,255,0.9)" : colors.textMuted,
          fontWeight: "700",
        },
        caption: {
          marginTop: 12,
          fontSize: typography.size.body,
          color: workout.imageUri ? "rgba(255,255,255,0.92)" : colors.text,
          fontWeight: "500",
        },
        bottomSafe: { height: 4 },
      }),
    [colors, typography, workout.imageUri],
  );

  const duration = formatDuration(workout.durationSeconds);
  const sets = workout.totalSets == null ? "--" : String(workout.totalSets);
  const volume =
    workout.totalVolume == null
      ? "--"
      : `${formatNumber(workout.totalVolume)} ${workout.volumeUnit ?? ""}`.trim();

  const top = (workout.topExercises ?? []).slice(0, 3);

  const content = (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {workout.title}
        </Text>
        <Text style={styles.date}>{formatDateShort(workout.completedAt)}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValueSmall}>{duration}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Sets</Text>
          <Text style={styles.statValueSmall}>{sets}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Volume</Text>
          <Text
            style={volume ? styles.statValue : styles.statValueSmall}
            numberOfLines={1}
          >
            {volume}
          </Text>
        </View>
      </View>

      <View style={styles.listWrap}>
        <Text style={styles.listTitle}>Top exercises</Text>
        {top.length ? (
          top.map((e) => (
            <View key={e.exerciseId} style={styles.listItem}>
              <Text style={styles.listLeft} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={styles.listRight}>
                {e.volume == null ? "--" : formatNumber(e.volume)}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.listItem}>
            <Text style={styles.listLeft}>—</Text>
            <Text style={styles.listRight}>—</Text>
          </View>
        )}
      </View>

      {!!caption?.trim() && (
        <Text style={styles.caption} numberOfLines={3}>
          {caption.trim()}
        </Text>
      )}
      <View style={styles.bottomSafe} />
    </View>
  );

  if (workout.imageUri) {
    return (
      <View style={styles.card}>
        <ImageBackground
          source={{ uri: workout.imageUri }}
          style={styles.image}
        >
          <View style={styles.overlay} />
          {content}
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.image}>{content}</View>
    </View>
  );
}
