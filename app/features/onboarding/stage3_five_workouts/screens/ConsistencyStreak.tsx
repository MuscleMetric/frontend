import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { Stage3Payload, Stage3UiStrings } from "../types";

import StreakRing from "../components/StreakRing";
import ConsistencyTrendCard from "../components/ConsistencyTrendCard";

function safeInt(n: any, fallback = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.round(v);
}

export default function ConsistencyStreak({
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

  const weeklyCompleted = safeInt(payload?.weekly_completed, 0);
  const weeklyGoal = Math.max(1, safeInt(payload?.weekly_goal_target, 3));
  const streakWeeks = safeInt(payload?.streak_weeks, 0);

  const ringProgress = Math.min(1, weeklyCompleted / weeklyGoal);

  const centerValue = `${weeklyCompleted}/${weeklyGoal}`;

  const overBy = weeklyCompleted - weeklyGoal;
  const highlight =
    overBy > 0
      ? `+${overBy} over goal`
      : weeklyCompleted === weeklyGoal
      ? "Goal met"
      : null;

  const body =
    weeklyCompleted >= weeklyGoal
      ? "You hit your weekly target. Keep it going next week to start a streak."
      : "Stay consistent this week. Hit your goal and we’ll start tracking your streak.";

  const footnote =
    streakWeeks > 0
      ? `🔥 ${streakWeeks} week streak active.`
      : "Streaks become meaningful after a couple of full weeks.";

  // Top badge (don’t lie: this is “sessions logged”, not “streak” unless you actually track streak)
  const topText = `${ui.workoutsTotalLabel} workouts logged`;
  const badgeText = "LIVE INSIGHT";

  return (
    <View style={styles.page}>
      <Text style={styles.h1}>
        Consistency <Text style={styles.h1Em}>that sticks.</Text>
      </Text>

      <Text style={styles.footer}>
        Small wins compound. We track it automatically so you can focus on the
        lifting.
      </Text>

      <View style={{ height: layout.space.md }} />

      <StreakRing
        progress={ringProgress}
        topText={topText}
        badgeText={badgeText}
        centerValue={centerValue}
        centerLabelTop="WORKOUTS"
        centerLabelBottom="This week"
      />

      <ConsistencyTrendCard
        title="CONSISTENCY"
        highlight={highlight}
        body={body}
      />
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    page: {
      flex: 1,
    },

    content: {
      paddingTop: layout.space.md,
      paddingBottom: layout.space.xxl,
    },

    h1: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 44,
      lineHeight: 52,
      letterSpacing: -1.2,
    },
    h1Em: {
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
    },

    footer: {
      marginTop: layout.space.lg,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      textAlign: "center",
      paddingHorizontal: layout.space.sm,
    },
  });
