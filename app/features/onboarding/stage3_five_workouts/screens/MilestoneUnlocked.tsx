// app/onboarding/stage3_five_workouts/screens/MilestoneUnlocked.tsx
import React, { useMemo, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { Stage3Payload, Stage3UiStrings } from "../types";

export default function MilestoneUnlocked({
  ui,
  payload,
}: {
  ui: Stage3UiStrings;
  payload?: Stage3Payload | null;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  useEffect(() => {
    console.log("[stage3] InsightsOverview payload:", payload);
  }, [payload]);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>MilestoneUnlocked (placeholder)</Text>
        <Text style={styles.sub}>
          We’ll build the “Why this looks different now” page here.
        </Text>

        <View style={styles.row}>
          <Text style={styles.meta}>workoutsTotalLabel</Text>
          <Text style={styles.value}>{ui.workoutsTotalLabel}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.meta}>windowLabel</Text>
          <Text style={styles.value}>{ui.windowLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    page: { flex: 1 },
    card: {
      borderRadius: layout.radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: layout.space.lg,
    },
    title: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
    },
    sub: {
      marginTop: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },
    row: {
      marginTop: layout.space.md,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: layout.space.md,
    },
    meta: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
    },
    value: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
    },
  });
