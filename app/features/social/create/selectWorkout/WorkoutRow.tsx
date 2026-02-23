// app/features/social/create/selectWorkout/WorkoutRow.tsx

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";
import type { WorkoutSelection } from "../state/createPostTypes";
import { formatDateShort, formatDuration, formatNumber } from "../shared/formatters";

type Props = {
  workout: WorkoutSelection;
  selected: boolean;
  onPress: () => void;
};

export default function WorkoutRow({ workout, selected, onPress }: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: 18,
          padding: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
          flexDirection: "row",
          alignItems: "center",
        },
        left: {
          flex: 1,
        },
        title: {
          fontSize: typography.size.body,
          fontWeight: "700",
          color: colors.text,
          marginBottom: 4,
        },
        meta: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
        },
        statsRow: {
          flexDirection: "row",
          marginTop: 10,
          gap: 12,
        },
        statPill: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 6,
        },
        statText: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "600",
        },
        right: {
          marginLeft: 12,
          alignItems: "flex-end",
          justifyContent: "space-between",
          height: 56,
        },
        check: {
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: selected ? colors.primary : colors.surface,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
        },
        thumb: {
          width: 56,
          height: 56,
          borderRadius: 14,
          backgroundColor: colors.surface,
          marginLeft: 12,
          overflow: "hidden",
        },
        thumbImg: {
          width: "100%",
          height: "100%",
        },
      }),
    [colors, typography, selected]
  );

  const durationLabel = formatDuration(workout.durationSeconds);
  const volumeLabel = workout.totalVolume == null ? "--" : formatNumber(workout.totalVolume);
  const volumeUnit = workout.volumeUnit ?? "";
  const setsLabel = workout.totalSets == null ? "--" : String(workout.totalSets);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.left}>
        <Text style={styles.title}>{workout.title}</Text>
        <Text style={styles.meta}>
          {formatDateShort(workout.completedAt)} • {durationLabel}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Icon name={"layers" as any} size={14} color={colors.textMuted} />
            <Text style={styles.statText}>{setsLabel} sets</Text>
          </View>

          <View style={styles.statPill}>
            <Icon name={"trending-up" as any} size={14} color={colors.textMuted} />
            <Text style={styles.statText}>
              {volumeLabel} {volumeUnit}
            </Text>
          </View>
        </View>
      </View>

      {workout.imageUri ? (
        <View style={styles.thumb}>
          <Image source={{ uri: workout.imageUri }} style={styles.thumbImg} />
        </View>
      ) : (
        <View style={styles.right}>
          <View style={styles.check}>
            {selected ? (
              <Icon name={"check" as any} size={16} color={colors.onPrimary} />
            ) : (
              <View />
            )}
          </View>

          <Icon name={"chevron-right" as any} size={18} color={colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );
}