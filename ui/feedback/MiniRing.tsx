import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useAppTheme } from "@/lib/useAppTheme";

export function MiniRing({
  valuePct,
  size = 44,
  stroke = 6,
  label,
  inverted = false,
}: {
  valuePct: number; // 0..100
  size?: number;
  stroke?: number;
  label?: string; // defaults to `${pct}%`
  inverted?: boolean;
}) {
  const { colors, typography } = useAppTheme();

  const pct = Math.max(0, Math.min(100, valuePct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  const trackColor = inverted ? colors.onPrimaryTrackBg : colors.trackBg;
  const progressColor = inverted ? colors.onPrimary : colors.primary;
  const textColor = inverted ? colors.onPrimary : colors.text;
  const textMuted = inverted ? colors.onPrimaryMuted : colors.textMuted;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: size, height: size, alignItems: "center", justifyContent: "center" },
        label: {
          position: "absolute",
          fontFamily: typography.fontFamily.bold,
          fontSize: 12,
          color: textColor,
        },
        sub: {
          position: "absolute",
          marginTop: 18,
          fontFamily: typography.fontFamily.medium,
          fontSize: 10,
          color: textMuted,
        },
      }),
    [size, typography, textColor, textMuted]
  );

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={progressColor}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      <Text style={styles.label}>{label ?? `${Math.round(pct)}%`}</Text>
    </View>
  );
}
