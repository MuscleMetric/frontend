import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Pill } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function plural(n: number, s: string) {
  return n === 1 ? `${n} ${s}` : `${n} ${s}s`;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function DonutRing({
  valuePct,
  size,
  stroke,
  fg,
  bg,
  children,
}: {
  valuePct: number; // 0..100
  size: number;
  stroke: number;
  fg: string;
  bg: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(valuePct, 0, 100);
  const dash = (pct / 100) * c;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {/* background */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={bg}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        {/* foreground */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fg}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          // start at top
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}

export default function ActivityCard({
  data,
  showPlanned,
}: {
  data: ProfileOverview;
  showPlanned: boolean;
}) {
  const { colors, typography, layout } = useAppTheme();

  const workoutsTotal = Math.max(0, data.counts.workouts_total ?? 0);

  const plannedLeft =
    showPlanned && data.active_plan?.planned_workouts_left != null
      ? Math.max(0, Number(data.active_plan.planned_workouts_left))
      : 0;

  const weeklyStreak = Math.max(0, data.activity.weekly_streak ?? 0);
  const stepsStreak = Math.max(0, data.activity.steps_streak_days ?? 0);

  const achUnlocked = Math.max(0, data.activity.achievements_unlocked ?? 0);
  const achTotal = Math.max(0, data.activity.achievements_total ?? 0);
  const achPct = clamp(data.activity.achievements_pct ?? 0, 0, 100);

  // ring meaning: completed vs (completed + planned left)
  const ringDenom = Math.max(workoutsTotal + plannedLeft, 1);
  const ringPct = Math.round((workoutsTotal / ringDenom) * 100);

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

        // ring block
        ringBlock: {
          alignItems: "center",
          gap: layout.space.md,
        },
        ringCenterLabel: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
        ringCenterValue: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
          color: colors.text,
          marginTop: 2,
        },

        legendRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: layout.space.lg,
          flexWrap: "wrap",
        },
        legendItem: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.sm,
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 999,
        },
        legendText: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        // tiles
        tilesRow: {
          flexDirection: "row",
          gap: layout.space.md,
        },
        tile: {
          flex: 1,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.trackBg,
          borderRadius: layout.radius.lg,
          padding: layout.space.md,
          gap: 6,
        },
        tileTitle: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
        tileValue: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        tileHint: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
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
        </View>

        <View style={styles.ringBlock}>
          <DonutRing
            valuePct={ringPct}
            size={150}
            stroke={14}
            fg={colors.success}
            bg={colors.trackBorder}
          >
            <Text style={styles.ringCenterLabel}>Total workouts</Text>
            <Text style={styles.ringCenterValue}>{workoutsTotal}</Text>
          </DonutRing>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Completed ({workoutsTotal})</Text>
            </View>

            {showPlanned ? (
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.trackBorder }]} />
                <Text style={styles.legendText}>Planned ({plannedLeft})</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.tilesRow}>
          <View style={styles.tile}>
            <Text style={styles.tileTitle}>Weekly Streak</Text>
            <Text style={styles.tileValue}>{plural(weeklyStreak, "week")}</Text>
            <Text style={styles.tileHint}>You’re on fire! Keep it up.</Text>
          </View>

          <View style={styles.tile}>
            <Text style={styles.tileTitle}>Step streak</Text>
            <Text style={styles.tileValue}>{plural(stepsStreak, "day")}</Text>
            <Text style={styles.tileHint}>Consistency builds momentum.</Text>
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
