// app/onboarding/stage3_five_workouts/screens/ConsistencyStreak.tsx
import React, { useMemo, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { Stage3Payload, Stage3UiStrings } from "../types";

export default function ConsistencyStreak({
  ui,
  payload,
}: {
  ui: Stage3UiStrings;
  payload?: Stage3Payload | null;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  useEffect(() => {
    console.log("[stage3] ConsistencyStreak payload:", payload);
  }, [payload]);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>ConsistencyStreak (placeholder)</Text>
        <Text style={styles.sub}>
          We’ll build the weekly ring + streak insight page here.
        </Text>

        <View style={styles.row}>
          <Text style={styles.meta}>weeklyProgressLabel</Text>
          <Text style={styles.value}>{ui.weeklyProgressLabel}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.meta}>streakLabel</Text>
          <Text style={styles.value}>{ui.streakLabel}</Text>
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
