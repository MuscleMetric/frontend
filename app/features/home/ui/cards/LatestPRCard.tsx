// app/features/home/cards/LatestPRCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card, Pill } from "@/ui";

export function LatestPRCard({ card, summary }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const exerciseId = card?.exercise_id ? String(card.exercise_id) : "";
  const exerciseName = String(card?.exercise_name ?? "Personal record");

  const bestWeight = card?.best_weight == null ? null : Number(card.best_weight);
  const bestReps = card?.best_reps == null ? null : Number(card.best_reps);

  const e1rmLabel = String(card?.display_value ?? "");
  const delta = card?.delta_pct == null ? null : Number(card.delta_pct);
  const achievedAt = card?.achieved_at ? String(card.achieved_at) : null;

  const deltaLabel = useMemo(() => {
    if (delta == null) return "New";
    if (delta >= 0) return `+${delta}%`;
    return `${delta}%`;
  }, [delta]);

  const pillTone = useMemo(() => {
    if (delta == null) return "primary";
    if (delta >= 5) return "success";
    if (delta >= 0) return "primary";
    return "neutral";
  }, [delta]);

  const headline =
    bestWeight != null && bestReps != null ? `${trim1(bestWeight)} kg × ${bestReps}` : null;

  const dateLabel = useMemo(() => {
    if (!achievedAt) return null;
    const d = new Date(achievedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [achievedAt]);

  const canOpen = !!exerciseId;

  const onPress = () => {
    if (!exerciseId) return;
    // Adjust this path to match your actual route file location.
    router.push({
      pathname: "features/progress/screens/deep-analytics",
      params: { exerciseId },
    });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!canOpen}
      style={({ pressed }) => [pressed && canOpen ? styles.pressed : null]}
      accessibilityRole="button"
      accessibilityLabel={canOpen ? `Open analytics for ${exerciseName}` : "Personal record"}
    >
      <Card style={styles.card}>
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
    </Pressable>
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
    pressed: {
      transform: [{ scale: 0.99 }],
      opacity: 0.96,
    },
    accent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: "rgba(245,158,11,0.55)",
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
