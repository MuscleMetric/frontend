import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function ProgressBar({
  progress, // 0..1
  height = 10,
}: {
  progress: number;
  height?: number;
}) {
  const { colors, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, layout, height), [colors, layout, height]);

  const p = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${p * 100}%` }]} />
    </View>
  );
}

const makeStyles = (colors: any, layout: any, height: number) =>
  StyleSheet.create({
    track: {
      height,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: layout.radius.pill,
      backgroundColor: colors.primary,
    },
  });
