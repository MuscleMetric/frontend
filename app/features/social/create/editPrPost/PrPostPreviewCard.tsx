// app/features/social/create/editPrPost/PrPostPreviewCard.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { PrSelection } from "../state/createPostTypes";
import { formatDateShort, formatNumber } from "../shared/formatters";

type Props = {
  pr: PrSelection;
  caption?: string;
};

export default function PrPostPreviewCard({ pr, caption }: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: 22,
          padding: 22,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        label: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "700",
          marginBottom: 6,
        },
        exercise: {
          fontSize: typography.size.h3 ?? typography.size.body,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 14,
        },
        value: {
          fontSize: 52,
          fontWeight: "900",
          color: colors.text,
          letterSpacing: -1,
        },
        unit: {
          fontSize: typography.size.h3 ?? typography.size.body,
          fontWeight: "800",
          color: colors.textMuted,
          marginLeft: 6,
        },
        valueRow: {
          flexDirection: "row",
          alignItems: "baseline",
          marginBottom: 10,
        },
        subtitle: {
          fontSize: typography.size.body,
          color: colors.primary,
          fontWeight: "700",
          marginBottom: 6,
        },
        delta: {
          fontSize: typography.size.meta,
          color: colors.success ?? colors.primary,
          fontWeight: "700",
        },
        date: {
          marginTop: 8,
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "600",
        },
        caption: {
          marginTop: 14,
          fontSize: typography.size.body,
          color: colors.text,
          fontWeight: "500",
        },
      }),
    [colors, typography]
  );

  const formattedValue = formatNumber(pr.value);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Personal Record</Text>

      <Text style={styles.exercise}>{pr.exerciseName}</Text>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{formattedValue}</Text>
        <Text style={styles.unit}>{pr.unit}</Text>
      </View>

      <Text style={styles.subtitle}>New Personal Best</Text>

      {pr.deltaValue != null && (
        <Text style={styles.delta}>
          +{formatNumber(pr.deltaValue)} improvement
        </Text>
      )}

      <Text style={styles.date}>{formatDateShort(pr.achievedAt)}</Text>

      {!!caption?.trim() && (
        <Text style={styles.caption}>{caption.trim()}</Text>
      )}
    </View>
  );
}