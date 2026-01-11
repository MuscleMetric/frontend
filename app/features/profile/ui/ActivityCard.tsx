import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ProgressBar, Pill } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function plural(n: number, s: string) {
  return n === 1 ? `${n} ${s}` : `${n} ${s}s`;
}

export default function ActivityCard({
  data,
  showPlanned,
}: {
  data: ProfileOverview;
  showPlanned: boolean;
}) {
  const { colors, typography, layout } = useAppTheme();

  const workoutsTotal = data.counts.workouts_total ?? 0;

  // planned workouts remaining (only meaningful with active plan)
  const plannedLeft =
    showPlanned && data.active_plan?.planned_workouts_left != null
      ? Math.max(0, Number(data.active_plan.planned_workouts_left))
      : 0;

  const weeklyStreak = Math.max(0, data.activity.weekly_streak ?? 0);
  const stepsStreak = Math.max(0, data.activity.steps_streak_days ?? 0);

  const achUnlocked = Math.max(0, data.activity.achievements_unlocked ?? 0);
  const achTotal = Math.max(0, data.activity.achievements_total ?? 0);
  const achPct = Math.max(0, Math.min(100, data.activity.achievements_pct ?? 0));

  // progress: completed vs planned (like your old gauge), but as a clean bar
  const totalForBar = Math.max(workoutsTotal + plannedLeft, 1);
  const barPct = Math.round((workoutsTotal / totalForBar) * 100);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        inner: {
          padding: layout.space.lg,
          gap: layout.space.lg,
        },

        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },

        // total
        totalWrap: {
          gap: layout.space.sm,
        },
        totalLabel: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
        totalValue: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h1,
          lineHeight: typography.lineHeight.h1,
          color: colors.text,
        },

        legendRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: layout.space.sm,
        },

        // streak grid
        grid: {
          flexDirection: "row",
          gap: layout.space.md,
        },
        miniCard: {
          flex: 1,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.trackBg,
          borderRadius: layout.radius.lg,
          padding: layout.space.md,
          gap: 6,
        },
        miniTitle: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
        miniValue: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        miniHint: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          opacity: 0.9,
        },

        achRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
        achLeft: { flex: 1, gap: 4 },
        achTitle: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.text,
        },
        achSub: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Activity</Text>
          <Pill tone="neutral" label={`${barPct}%`} />
        </View>

        <View style={styles.totalWrap}>
          <Text style={styles.totalLabel}>Total workouts</Text>
          <Text style={styles.totalValue}>{workoutsTotal}</Text>

          <ProgressBar valuePct={barPct} />

          <View style={styles.legendRow}>
            <Pill tone="success" label={`Completed (${workoutsTotal})`} />
            {showPlanned ? <Pill tone="neutral" label={`Planned (${plannedLeft})`} /> : null}
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.miniCard}>
            <Text style={styles.miniTitle}>Weekly workout streak</Text>
            <Text style={styles.miniValue}>{plural(weeklyStreak, "week")}</Text>
            <Text style={styles.miniHint}>Hit your weekly goal to keep it going.</Text>
          </View>

          <View style={styles.miniCard}>
            <Text style={styles.miniTitle}>Step streak</Text>
            <Text style={styles.miniValue}>{plural(stepsStreak, "day")}</Text>
            <Text style={styles.miniHint}>Consistency builds momentum.</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.achRow}>
          <View style={styles.achLeft}>
            <Text style={styles.achTitle}>Achievements</Text>
            <Text style={styles.achSub}>
              {achUnlocked} of {achTotal} unlocked · {achPct}%
            </Text>
          </View>
          <Pill tone="primary" label={`${achPct}%`} />
        </View>
      </View>
    </Card>
  );
}
