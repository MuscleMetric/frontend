import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

import type { Stage3Payload, Stage3UiStrings } from "../types";
import { InsightsUnlockedCard } from "../components/InsightsUnlockedCard";
import { ScrollView } from "react-native-gesture-handler";

export default function InsightsOverview({
  ui,
  payload,
}: {
  ui: Stage3UiStrings;
  payload?: Stage3Payload | null;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const workoutsTotal = ui.workoutsTotalLabel || "5";

  const items = [
    {
      iconName: "trending-up-outline",
      title: "Progress trends",
      subtitle: "Visualize your strength trajectory over time",
    },
    {
      iconName: "barbell-outline",
      title: "Strength milestones",
      subtitle: "Personal records tracking and achievement highlights",
    },
    {
      iconName: "calendar-outline",
      title: "Consistency tracking",
      subtitle: "Monthly frequency heatmaps",
    },
    {
      iconName: "navigate-outline",
      title: "Goal pacing",
      subtitle: "Step by step guide towards your strength goals",
    },
  ];

  return (
    <View style={styles.page}>
      <Text style={styles.h1}>
        Dashboards have been <Text style={styles.h1Em}>improved</Text>
      </Text>

      <View style={{ height: layout.space.lg }} />

      <InsightsUnlockedCard title="Insights unlocked" items={items} />

      <View style={{ height: layout.space.lg }} />

      <Text style={styles.footer}>
        With <Text style={styles.footerEm}>{workoutsTotal} workouts</Text>, your
        data becomes meaningful. We can now show real patterns — not guesses.
      </Text>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    page: {
      flex: 1,
      alignItems: "center",
      paddingTop: layout.space.md,
    },

    h1: {
      marginTop: layout.space.lg,
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 36,
      lineHeight: 42,
      letterSpacing: -1.0,
      textAlign: "center",
      paddingHorizontal: layout.space.lg,
    },
    h1Em: {
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
    },

    footer: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      textAlign: "center",
      paddingHorizontal: layout.space.xl,
      maxWidth: 520,
    },
    footerEm: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
    },
  });
