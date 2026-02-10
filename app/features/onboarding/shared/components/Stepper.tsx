import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";

export function Stepper({
  label,
  progress,
  rightLabel,
}: {
  label: string;
  progress: number; // 0..1
  rightLabel?: string;
}) {
  const { colors, typography } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const pct = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.left}>{label}</Text>
        {rightLabel ? <Text style={styles.right}>{rightLabel}</Text> : null}
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    wrap: { marginTop: 10, marginBottom: 14 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    left: {
      color: colors.textMuted ?? colors.subtle,
      fontSize: 12,
      letterSpacing: 1.1,
      fontFamily: typography?.fontFamily?.semibold,
    },
    right: {
      color: colors.textMuted ?? colors.subtle,
      fontSize: 12,
      fontFamily: typography?.fontFamily?.semibold,
    },
    track: {
      marginTop: 10,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.trackBg ?? "rgba(255,255,255,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder ?? "rgba(255,255,255,0.10)",
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
  });
