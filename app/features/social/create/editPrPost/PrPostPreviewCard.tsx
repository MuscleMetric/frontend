// app/features/social/create/editPrPost/PrPostPreviewCard.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuth } from "@/lib/authContext";
import type { PrSelection } from "../state/createPostTypes";
import { UserMetaRow } from "@/app/features/social/feed/components/UserMetaRow";

type Props = {
  pr: PrSelection;
  caption?: string;
  containerStyle?: ViewStyle;
};

function fmtInt(value: number | null | undefined) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function PrPostPreviewCard({
  pr,
  caption,
  containerStyle,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const { profile } = useAuth();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl ?? layout.radius.lg,
          padding: layout.space.lg,
        },

        prWrap: {
          marginTop: layout.space.lg,
          borderRadius: layout.radius.lg,
          backgroundColor: colors.surface,
          alignItems: "center",
          paddingVertical: layout.space.lg,
          paddingHorizontal: layout.space.md,
        },

        exercise: {
          color: colors.primary,
          fontFamily: typography.fontFamily.bold,
          fontSize: 14,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 10,
          textAlign: "center",
        },

        bigRow: {
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "center",
          gap: 10,
        },

        bigValue: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 64,
          lineHeight: 68,
          letterSpacing: -1,
          textAlign: "center",
        },

        unit: {
          color: colors.primary,
          fontFamily: typography.fontFamily.bold,
          fontSize: 40,
          lineHeight: 68,
          marginBottom: 8,
        },

        reps: {
          marginTop: 6,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: 16,
          lineHeight: 20,
          textAlign: "center",
        },

        secondary: {
          marginTop: 10,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          textAlign: "center",
        },

        deltaChip: {
          marginTop: layout.space.md,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: "rgba(34,197,94,0.12)",
        },

        deltaText: {
          color: "rgb(22,163,74)",
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        caption: {
          marginTop: layout.space.md,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          textAlign: "center",
          paddingHorizontal: layout.space.md,
        },
      }),
    [colors, typography, layout],
  );

  const viewerName = profile?.name?.trim() ? profile.name : "You";
  const viewerUsername = (profile as any)?.username ?? null;

  const exerciseName = (pr.exerciseName ?? "Exercise").toUpperCase();
  const valueLabel = fmtInt(pr.value);
  const unitLabel = pr.unit ?? "kg";
  const repsLabel = pr.reps != null ? `x ${fmtInt(pr.reps)}` : null;

  const deltaLabel =
    pr.deltaValue != null
      ? `${pr.deltaValue > 0 ? "+" : ""}${fmtInt(pr.deltaValue)} ${unitLabel} over previous best`
      : null;

  return (
    <View style={[styles.card, containerStyle]}>
      <UserMetaRow
        name={viewerName}
        username={viewerUsername}
        createdAt={new Date().toISOString()}
        subtitleLeft="New Personal Record"
      />

      <View style={styles.prWrap}>
        <Text style={styles.exercise} numberOfLines={2}>
          {exerciseName}
        </Text>

        <View style={styles.bigRow}>
          <Text style={styles.bigValue}>{valueLabel}</Text>
          <Text style={styles.unit}>{unitLabel}</Text>
          {!!repsLabel && <Text style={styles.reps}>{repsLabel} reps</Text>}
        </View>

        {!!deltaLabel && (
          <View style={styles.deltaChip}>
            <Text style={styles.deltaText}>{deltaLabel}</Text>
          </View>
        )}
      </View>

      {!!caption?.trim() && (
        <Text style={styles.caption}>{caption.trim()}</Text>
      )}
    </View>
  );
}
