import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Button, ProgressBar, Pill } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

export default function ActivePlanCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();
  const plan = data.active_plan;

  if (!plan) return null;

  const weeklyPct = Math.max(0, Math.min(100, plan.weekly_progress_pct ?? 0));
  const completed = Math.max(0, plan.completed_this_week ?? 0);
  const target = Math.max(0, plan.weekly_target_sessions ?? 0);
  const weeksLeft = plan.weeks_left_future ?? null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        inner: {
          padding: layout.space.lg,
          gap: layout.space.md,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
        titleWrap: { flex: 1, gap: 4 },
        label: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        sub: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
        midRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        big: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
          color: colors.text,
        },
        smallMuted: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
        ctaRow: {
          marginTop: layout.space.xs,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card>
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.label}>Active Plan</Text>
            <Text style={styles.title} numberOfLines={1}>
              {plan.title}
            </Text>
            <Text style={styles.sub}>
              Weekly target · {completed}/{target} workouts
              {weeksLeft != null ? ` · ${weeksLeft} weeks left` : ""}
            </Text>
          </View>

          <Pill tone={weeklyPct >= 100 ? "success" : "neutral"} label={`${weeklyPct}%`} />
        </View>

        <ProgressBar valuePct={weeklyPct} />

        <View style={styles.midRow}>
          <Text style={styles.big}>{completed}</Text>
          <Text style={styles.smallMuted}>done this week</Text>
        </View>

        <View style={styles.ctaRow}>
          <Button
            title="View plan"
            onPress={() =>
              router.push({
                pathname: "/features/plans/history/view",
                params: { planId: plan.plan_id },
              })
            }
          />
        </View>
      </View>
    </Card>
  );
}
