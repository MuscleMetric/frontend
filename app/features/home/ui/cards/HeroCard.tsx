import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { performCTA } from "../../cta";
import { Card, Button, Pill } from "@/ui";

function fmtDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

export function HeroCard({ card, summary }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const badge = card?.badge ? String(card.badge) : null;
  const title = String(card?.title ?? "");
  const subtitle = card?.subtitle ? String(card.subtitle) : null;

  const primary = card?.primary_cta;
  const secondary = card?.secondary_cta;

  const meta = card?.meta ?? {};

  const planWeek = meta?.plan_week_number ?? meta?.week_number ?? null;
  const weekWorkout = meta?.week_workout_number ?? meta?.workout_number ?? null;

  const exerciseCount = meta?.exercise_count != null ? Number(meta.exercise_count) : null;
  const avgDuration = meta?.avg_duration_seconds != null ? Number(meta.avg_duration_seconds) : null;

  const statsLine = useMemo(() => {
    const parts: string[] = [];
    const d = fmtDuration(avgDuration);
    if (d) parts.push(d);
    if (exerciseCount != null) parts.push(`${exerciseCount} exercises`);
    return parts.length ? parts.join(" · ") : null;
  }, [avgDuration, exerciseCount]);

  const onPrimary = () => primary?.cta && performCTA(primary.cta);
  const onSecondary = () => secondary?.cta && performCTA(secondary.cta);

  return (
    <Card variant="pressable" onPress={onPrimary} style={styles.card}>
      {/* Accent blob (brand energy) */}
      <View pointerEvents="none" style={styles.accentBlob} />

      <View style={{ gap: layout.space.md }}>
        <View style={styles.topRow}>
          {badge ? <Pill label={badge} tone="primary" /> : <View />}

          {(planWeek != null || weekWorkout != null) ? (
            <View style={styles.weekBox}>
              {planWeek != null ? (
                <Text style={styles.weekText} numberOfLines={1}>
                  Week {Number(planWeek)}
                </Text>
              ) : null}
              {weekWorkout != null ? (
                <Text style={styles.workoutText} numberOfLines={1}>
                  Workout {Number(weekWorkout)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {subtitle ? (
          <View style={{ gap: layout.space.xs }}>
            <Text style={styles.subtitle} numberOfLines={3}>
              {subtitle}
            </Text>

            {statsLine ? (
              <Text style={styles.statsLine} numberOfLines={1}>
                {statsLine}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.ctaRow}>
          <View style={{ flex: 1 }}>
            <Button
              title={String(primary?.label ?? "Continue")}
              onPress={onPrimary}
              variant="primary"
              leftIcon={null}
            />
          </View>

          {secondary?.cta ? (
            <View style={{ width: 130 }}>
              <Button
                title={String(secondary?.label ?? "Details")}
                onPress={onSecondary}
                variant="secondary"
                fullWidth
              />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      overflow: "hidden",
      borderRadius: layout.radius.xl,
      padding: layout.space.lg,
    },

    accentBlob: {
      position: "absolute",
      right: -40,
      top: -30,
      width: 140,
      height: 140,
      borderRadius: 999,
      backgroundColor: "rgba(37,99,235,0.16)",
    },

    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: layout.space.md,
    },

    weekBox: {
      alignItems: "flex-end",
      gap: 2,
    },

    weekText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.textMuted,
      letterSpacing: 0.2,
    },

    workoutText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.text,
      letterSpacing: 0.2,
    },

    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h1,
      lineHeight: typography.lineHeight.h1,
      letterSpacing: -0.6,
      color: colors.text,
    },

    subtitle: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.textMuted,
    },

    statsLine: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.textMuted,
      letterSpacing: 0.1,
    },

    ctaRow: {
      marginTop: layout.space.sm,
      flexDirection: "row",
      gap: layout.space.sm,
      alignItems: "center",
    },
  });
