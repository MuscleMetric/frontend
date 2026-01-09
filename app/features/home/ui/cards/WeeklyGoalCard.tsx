// app/features/home/cards/WeeklyGoalCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card } from "@/ui";

type Status = "on_track" | "behind" | "complete";

export function WeeklyGoalCard({
  card,
  summary,
}: {
  card: any;
  summary?: any;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const value = Number(card?.value ?? 0);
  const target = Number(card?.target ?? 0);
  const status = (card?.status ?? "behind") as Status;

  const pct =
    target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  const tone = useMemo(() => {
    // Motivating, not punishing
    if (status === "complete") return "complete";
    if (status === "on_track") return "on_track";
    return "behind";
  }, [status]);

  const toneCfg = useMemo(() => {
    if (tone === "complete") {
      return {
        fill: colors.success,
        tint: "rgba(34,197,94,0.14)",
        border: "rgba(34,197,94,0.25)",
        label: "On fire",
      };
    }
    if (tone === "on_track") {
      return {
        fill: colors.primary,
        tint: "rgba(37,99,235,0.14)",
        border: "rgba(37,99,235,0.25)",
        label: "On track",
      };
    }
    // behind
    return {
      fill: colors.warning,
      tint: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.25)",
      label: "Catch up",
    };
  }, [tone, colors]);

  const hint =
    target > 0
      ? `${pct}% of your weekly goal`
      : "Set a weekly goal to track progress";

  return (
    <Card style={styles.card}>
      <View style={{ gap: layout.space.md }}>
        {/* Header row */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>WEEKLY</Text>
            <Text style={styles.subkicker}>{toneCfg.label}</Text>
          </View>

          <View
            style={[
              styles.iconBadge,
              { backgroundColor: toneCfg.tint, borderColor: toneCfg.border },
            ]}
          >
            <Text style={styles.iconText}>📅</Text>
          </View>
        </View>

        {/* Big value */}
        <View style={styles.bigRow}>
          <Text style={styles.big}>{value}</Text>
          <Text style={styles.of}>/ {target > 0 ? target : "—"}</Text>
        </View>

        <Text style={styles.caption}>Workouts done</Text>

        {/* Progress bar */}
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${pct}%`, backgroundColor: toneCfg.fill },
            ]}
          />
        </View>

        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      </View>
    </Card>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      padding: layout.space.lg,
      borderRadius: layout.radius.xl,
    },

    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },

    kicker: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
      letterSpacing: 1.1,
      textTransform: "uppercase",
      color: colors.textMuted,
    },

    subkicker: {
      marginTop: 4,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
      color: colors.text,
    },

    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: layout.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: "center",
      justifyContent: "center",
    },

    iconText: {
      fontSize: 16,
      marginTop: 1,
    },

    bigRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: layout.space.sm,
    },

    big: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.hero,
      lineHeight: typography.lineHeight.hero,
      letterSpacing: -0.8,
      color: colors.text,
    },

    of: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
      color: colors.textMuted,
      paddingBottom: 8,
    },

    caption: {
      marginTop: -6,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.textMuted,
    },

    track: {
      height: 10,
      borderRadius: layout.radius.pill,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      backgroundColor: colors.trackBg,
    },

    fill: {
      height: "100%",
      borderRadius: layout.radius.pill,
    },

    hint: {
      fontFamily: typography.fontFamily.medium,
      fontSize: 11,
      color: colors.textMuted,
    },
  });
