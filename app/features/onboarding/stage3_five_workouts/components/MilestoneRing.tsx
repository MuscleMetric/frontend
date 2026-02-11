import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function MilestoneRing({
  value,
  label,
  size = 190,
  dot = true,
}: {
  value: string; // "5"
  label: string; // "WORKOUTS"
  size?: number;
  dot?: boolean;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout, size),
    [colors, typography, layout, size]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.ring}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      {dot ? <View style={styles.dot} /> : null}
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any, size: number) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: layout.space.lg,
      marginBottom: layout.space.lg,
    },
    ring: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 4,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    value: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 64,
      lineHeight: 66,
      letterSpacing: -1.6,
    },
    label: {
      marginTop: 6,
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 2.2,
      textTransform: "uppercase",
    },
    dot: {
      position: "absolute",
      // top-right-ish like the design
      top: 18,
      right: 54,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.primary,
    },
  });
