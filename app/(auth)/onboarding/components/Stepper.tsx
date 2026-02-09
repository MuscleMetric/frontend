import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

export function Stepper({
  label,
  progress,
  rightLabel,
}: {
  label: string;        // "STEP 1 OF 6"
  progress: number;     // 0..1
  rightLabel?: string;  // "75% Complete"
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ width: 80 }} />
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.right}>{rightLabel ?? ""}</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      marginTop: 6,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    label: {
      color: colors.subtle,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      textAlign: "center",
      flex: 1,
    },
    right: {
      width: 80,
      color: colors.subtle,
      fontSize: 12,
      fontWeight: "800",
      textAlign: "right",
    },
    track: {
      height: 4,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.08)",
      overflow: "hidden",
    },
    fill: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
  });
