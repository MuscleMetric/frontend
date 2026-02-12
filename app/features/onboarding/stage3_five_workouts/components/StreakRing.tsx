import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useAppTheme } from "@/lib/useAppTheme";

type Props = {
  size?: number; // default 260
  strokeWidth?: number; // default 18
  progress: number; // 0..1
  topText?: string; // e.g. "5 SESSION STREAK"
  badgeText?: string; // e.g. "LIVE INSIGHT"
  centerValue: string; // e.g. "2/3"
  centerLabelTop?: string; // e.g. "WORKOUTS"
  centerLabelBottom?: string; // e.g. "This week"
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export default function StreakRing({
  size = 260,
  strokeWidth = 18,
  progress,
  topText,
  badgeText,
  centerValue,
  centerLabelTop,
  centerLabelBottom,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const p = clamp01(progress);

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * p;

  return (
    <View style={styles.wrap}>
      {/* Top badges row */}
      <View style={styles.topRow}>
        {topText ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{topText}</Text>
          </View>
        ) : (
          <View />
        )}

        {badgeText ? (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        ) : null}
      </View>

      {/* Ring */}
      <View style={styles.ringWrap}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.trackBorder}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeLinecap="round"
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>

        {/* Center labels */}
        <View style={styles.center}>
          <Text style={styles.centerValue}>{centerValue}</Text>
          {!!centerLabelTop ? <Text style={styles.centerTop}>{centerLabelTop}</Text> : null}
          {!!centerLabelBottom ? <Text style={styles.centerBottom}>{centerLabelBottom}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    wrap: {
      width: "100%",
      alignItems: "center",
    },

    topRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: layout.space.md,
    },

    pill: {
      paddingHorizontal: layout.space.md,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },
    pillText: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 1.0,
      textTransform: "uppercase",
    },

    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: layout.space.md,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },
    badgeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    badgeText: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },

    ringWrap: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
    },

    center: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
    },
    centerValue: {
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
      fontSize: 64,
      letterSpacing: -2,
      lineHeight: 64,
    },
    centerTop: {
      marginTop: 6,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    centerBottom: {
      marginTop: 4,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
    },
  });
