import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

import type { Stage3Payload, Stage3UiStrings } from "../types";
import { MilestoneRing } from "../components/MilestoneRing";
import { InsightCard } from "../components/InsightCard";

export default function MilestoneUnlocked({
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

  // These should already be nicely formatted by the rpc → ui mapper
  const workoutsValue = ui.workoutsTotalLabel || "5";

  // Use the existing ui copy you already generate
  // Example: "You improved your estimated strength by 12%."
  const highlight = ui.heroStatLabel || "You improved your estimated strength by 12%.";
  const supporting =
    ui.heroStatSub || "You’ve built enough history to unlock advanced insights.";

  return (
    <View style={styles.page}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>MILESTONE UNLOCKED</Text>
      </View>

      <MilestoneRing value={workoutsValue} label="WORKOUTS" />

      <Text style={styles.h1}>You’ve built{"\n"}real momentum.</Text>

      <View style={{ height: layout.space.lg }} />

      <InsightCard title={highlight} subtitle={supporting} />
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

    badge: {
      paddingHorizontal: layout.space.lg,
      paddingVertical: 10,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      marginTop: layout.space.sm,
    },
    badgeText: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 2.2,
      textTransform: "uppercase",
    },

    h1: {
      marginTop: layout.space.sm,
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 36,
      lineHeight: 42,
      letterSpacing: -1.0,
      textAlign: "center",
      paddingHorizontal: layout.space.lg,
    },
  });
