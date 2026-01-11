import React, { useMemo } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function ProgressBar({
  valuePct,
  tone = "primary",
  height = 5,
  style,
}: {
  valuePct: number; // 0..100
  tone?: "primary" | "success" | "warning" | "danger";
  height?: number;
  style?: ViewStyle;
}) {
  const { colors, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, layout, height, tone), [colors, layout, height, tone]);

  const pct = Math.max(0, Math.min(100, Number(valuePct || 0)));

  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const makeStyles = (colors: any, layout: any, height: number, tone: string) => {
  const fill =
    tone === "success"
      ? colors.success
      : tone === "warning"
      ? colors.warning
      : tone === "danger"
      ? colors.danger
      : colors.primary;

  return StyleSheet.create({
    track: {
      height,
      borderRadius: layout.radius.pill,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      backgroundColor: colors.trackBg,
    },
    fill: {
      height: "100%",
      borderRadius: layout.radius.pill,
      backgroundColor: fill,
    },
  });
};
