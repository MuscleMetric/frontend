import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Pill, MiniRing } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function trackLabel(pct: number) {
  if (pct >= 70) return "On Track";
  if (pct >= 40) return "Catch Up";
  return "Behind";
}

function trackTone(pct: number): "success" | "warning" | "danger" | "neutral" {
  if (pct >= 70) return "success";
  if (pct >= 40) return "warning";
  return "danger";
}

export default function ActivePlanCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();
  const plan = data.active_plan;
  if (!plan) return null;

  const weeksCompletedPct = useMemo(() => {
    const wi = plan.week_index ?? null; // 1-based current week
    const wt = plan.weeks_total ?? null;

    if (!wi || !wt || wt <= 0) return 0;

    // weeks completed (excluding current week)
    const raw = ((wi - 1) / wt) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [plan.week_index, plan.weeks_total]);

  const weeklyPct = Math.max(0, Math.min(100, plan.weekly_progress_pct ?? 0));
  const completed = Math.max(0, plan.completed_this_week ?? 0);
  const target = Math.max(0, plan.weekly_target_sessions ?? 0);

  const weeksTotal = plan.weeks_total ?? null;
  const weekIndex = plan.week_index ?? null;

  const label = trackLabel(weeklyPct);
  const tone = trackTone(weeklyPct);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        inner: {
          gap: layout.space.lg,
        },

        topRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: layout.space.md,
        },

        titleWrap: { flex: 1, gap: 6 },

        labelSmall: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.onPrimaryMuted,
        },

        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
          color: colors.onPrimary,
        },

        sub: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.onPrimaryMuted,
        },

        rightTop: {
          alignItems: "flex-end",
          gap: layout.space.sm,
        },

        rightRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.sm,
        },

        // Weekly target section (progress + 4/3)
        weeklyRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.lg,
        },

        weeklyLeft: { flex: 1, gap: layout.space.sm },
        weeklyRight: { alignItems: "flex-end", gap: 2 },

        kpi: {
          fontFamily: typography.fontFamily.bold,
          fontSize: 34,
          lineHeight: 38,
          color: colors.onPrimary,
        },

        kpiMeta: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.onPrimaryMuted,
        },

        // Inverted progress bar (so we don't need ProgressBar changes)
        track: {
          height: 5,
          borderRadius: layout.radius.pill,
          backgroundColor: colors.onPrimaryTrackBg,
          overflow: "hidden",
        },
        fill: {
          height: "100%",
          borderRadius: layout.radius.pill,
          backgroundColor: colors.onPrimary,
        },

        // CTA matches design (outlined white)
        cta: {
          marginTop: layout.space.sm,
          borderRadius: layout.radius.xl,
          borderWidth: 2,
          borderColor: colors.onPrimaryBorder,
          paddingVertical: 18,
          alignItems: "center",
          justifyContent: "center",
        },
        ctaText: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.onPrimary,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card variant="primary" padded>
      <View style={styles.inner}>
        {/* Top row */}
        <View style={styles.topRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.labelSmall}>Active Plan</Text>
            <Text style={styles.title} numberOfLines={1}>
              {plan.title}
            </Text>

            <Text style={styles.sub}>
              {weekIndex != null && weeksTotal != null
                ? `Week ${weekIndex} of ${weeksTotal}`
                : " "}
            </Text>
          </View>

          <View style={styles.rightTop}>
            <View style={styles.rightRow}>
              <MiniRing valuePct={weeksCompletedPct} inverted label={`${weeksCompletedPct}%`} />
            </View>
          </View>
        </View>

        {/* Weekly target + progress */}
        <View style={styles.weeklyRow}>
          <View style={styles.weeklyLeft}>
            <Text style={styles.labelSmall}>Weekly target</Text>

            <View style={styles.track}>
              <View style={[styles.fill, { width: `${weeklyPct}%` }]} />
            </View>
          </View>

          <View style={styles.weeklyRight}>
            <Text style={styles.kpi}>
              {completed}/{target}
            </Text>
            <Text style={styles.kpiMeta}>Workouts</Text>
          </View>
        </View>

        {/* CTA */}
        <Pressable
          style={styles.cta}
          onPress={() =>
            router.push({
              pathname: "/features/plans/history/view",
              params: { planId: plan.plan_id },
            })
          }
        >
          <Text style={styles.ctaText}>View Plan</Text>
        </Pressable>
      </View>
    </Card>
  );
}
