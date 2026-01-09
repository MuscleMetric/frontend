// app/features/home/cards/LatestPRCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card, Pill } from "@/ui";

export function LatestPRCard({ card, summary }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const exerciseName = String(card?.exercise_name ?? "Personal record");

  const bestWeight = card?.best_weight == null ? null : Number(card.best_weight);
  const bestReps = card?.best_reps == null ? null : Number(card.best_reps);

  const e1rmLabel = String(card?.display_value ?? "");
  const delta = card?.delta_pct == null ? null : Number(card.delta_pct);
  const achievedAt = card?.achieved_at ? String(card.achieved_at) : null;

  // Label + tone for the pill
  const deltaLabel = useMemo(() => {
    if (delta == null) return "New";
    if (delta >= 0) return `+${delta}%`;
    // PR cards should not feel punishing — treat negative as neutral unless you really mean regression
    return `${delta}%`;
  }, [delta]);

  const pillTone = useMemo(() => {
    if (delta == null) return "primary";
    if (delta >= 5) return "success"; // bigger jump = green
    if (delta >= 0) return "primary"; // modest improvement = blue
    return "neutral"; // avoid red shame on a PR card
  }, [delta]);

  const headline =
    bestWeight != null && bestReps != null ? `${trim1(bestWeight)} kg × ${bestReps}` : null;

  const dateLabel = useMemo(() => {
    if (!achievedAt) return null;
    const d = new Date(achievedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [achievedAt]);

  return (
    <Card style={styles.card}>
      {/* subtle accent bar to make it feel “award-like” */}
      <View pointerEvents="none" style={styles.accent} />

      <View style={{ gap: layout.space.sm }}>
        <View style={styles.row}>
          <Text style={styles.kicker}>Latest PR</Text>
          <Pill label={deltaLabel} tone={pillTone as any} />
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {exerciseName}
        </Text>

        {headline ? (
          <Text style={styles.big} numberOfLines={1}>
            {headline}
          </Text>
        ) : null}

        {!!e1rmLabel ? (
          <Text style={styles.subtle} numberOfLines={1}>
            {e1rmLabel}
          </Text>
        ) : null}

        {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
      </View>
    </Card>
  );
}

function trim1(n: number) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      padding: layout.space.lg,
      borderRadius: layout.radius.xl,
      overflow: "hidden",
    },

    // Small accent on the left to “trophy” the card without being loud
    accent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: "rgba(245,158,11,0.55)", // gold-ish accent (neutral to both modes)
    },

    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    kicker: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
      letterSpacing: 1.1,
      textTransform: "uppercase",
      color: colors.textMuted,
    },

    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      letterSpacing: -0.2,
      color: colors.text,
    },

    big: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h1,
      lineHeight: typography.lineHeight.h1,
      letterSpacing: -0.7,
      color: colors.text,
      marginTop: 2,
    },

    subtle: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.textMuted,
      marginTop: -2,
    },

    date: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      color: colors.textMuted,
    },
  });
