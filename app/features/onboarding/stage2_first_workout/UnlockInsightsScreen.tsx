import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

import { InsightRow } from "./components/InsightRow";
import { ProgressBar } from "./components/ProgressBar";
import { PrimaryCTA } from "../shared/components/PrimaryCTA";
import { markOnboardingStageComplete } from "../shared/rpc";

type UnlockingInsightsProps = {
  workoutsCompleted?: number; // from gate RPC (1..5)
};

export default function UnlockingInsights(props: UnlockingInsightsProps) {
  const { colors, typography, layout } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(false);

  const completed = Math.max(1, Math.min(5, props.workoutsCompleted ?? 1));
  const remaining = Math.max(0, 5 - completed);
  const progress = completed / 5;

  async function onPrimary() {
    if (loading) return;
    setLoading(true);
    try {
      await markOnboardingStageComplete("stage2");
    } catch (e) {
      console.warn("mark stage2 complete failed", e);
    } finally {
      setLoading(false);
      router.replace("/(tabs)/workout");
    }
  }

  return (
    <View style={styles.page}>
      {/* Background glow (no image needed) */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <View style={[styles.body, { paddingTop: Math.max(insets.top, layout.space.lg) }]}>
        {/* Kicker row */}
        <View style={styles.kickerRow}>
          <View style={styles.kickerIcon}>
            <Icon name="star" size={14} color={colors.primary} />
          </View>
          <Text style={styles.kickerText}>PREMIUM EXPERIENCE</Text>
        </View>

        {/* Title */}
        <Text style={styles.h1}>This is where it gets good</Text>
        <Text style={styles.sub}>
          Log more sessions to unlock deep data analysis and personalized performance
          trends.
        </Text>

        {/* Insight cards */}
        <View style={styles.insights}>
          <InsightRow
            indexLabel="INSIGHT 01"
            title="Progress over time"
            subtitle="Visual volume tracking"
            iconName="stats-chart-outline"
            locked
          />
          <InsightRow
            indexLabel="INSIGHT 02"
            title="Personal bests"
            subtitle="Milestone detection"
            iconName="trophy-outline"
            locked
          />
          <InsightRow
            indexLabel="INSIGHT 03"
            title="Consistency streaks"
            subtitle="Habit building data"
            iconName="calendar-outline"
            locked
          />
        </View>

        {/* Unlocking section */}
        <View style={styles.unlockHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.unlockTitle}>UNLOCKING INSIGHTS</Text>
            <Text style={styles.unlockSub}>
              Complete <Text style={styles.unlockBold}>{remaining} more</Text> to reveal stats
            </Text>
          </View>

          <Text style={styles.unlockRight}>
            {completed} <Text style={styles.unlockRightMuted}>/ 5 workouts</Text>
          </Text>
        </View>

        <ProgressBar progress={progress} />

        <View style={{ flex: 1 }} />
      </View>

      {/* Bottom CTA */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, layout.space.md) }]}>
        <PrimaryCTA title="Start next workout" onPress={onPrimary} loading={loading} />
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.bg,
    },

    body: {
      flex: 1,
      paddingHorizontal: layout.space.lg,
    },

    bottom: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.md,
    },

    // ---- glow layers (no rgba strings, use opacity) ----
    glowTop: {
      position: "absolute",
      top: -120,
      left: -120,
      width: 360,
      height: 360,
      borderRadius: 360,
      backgroundColor: colors.primary,
      opacity: 0.10,
    },
    glowBottom: {
      position: "absolute",
      bottom: -160,
      right: -160,
      width: 420,
      height: 420,
      borderRadius: 420,
      backgroundColor: colors.primary,
      opacity: 0.08,
    },

    // ---- header ----
    kickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
      marginTop: layout.space.sm,
      marginBottom: layout.space.md,
    },
    kickerIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    kickerText: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 1.8,
      fontSize: typography.size.meta,
    },

    h1: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.hero,
      lineHeight: typography.lineHeight.hero,
      letterSpacing: -1,
      marginTop: layout.space.xs,
    },
    sub: {
      marginTop: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      maxWidth: 420,
    },

    insights: {
      marginTop: layout.space.xl,
      gap: layout.space.md,
    },

    // ---- unlocking section ----
    unlockHeader: {
      marginTop: layout.space.xl,
      marginBottom: layout.space.sm,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: layout.space.md,
    },
    unlockTitle: {
      color: colors.text,
      opacity: 0.85,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 1.4,
      fontSize: typography.size.meta,
    },
    unlockSub: {
      marginTop: layout.space.xs,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },
    unlockBold: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
    },
    unlockRight: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      letterSpacing: -0.2,
    },
    unlockRightMuted: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
    },
  });
