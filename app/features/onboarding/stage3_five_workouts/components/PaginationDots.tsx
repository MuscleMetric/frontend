// app/onboarding/stage3_five_workouts/components/PaginationDots.tsx

import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function PaginationDots({
  total,
  activeIndex,
}: {
  total: number;
  activeIndex: number;
}) {
  const { colors, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, layout), [colors, layout]);

  const safeTotal = Math.max(1, total);
  const safeActive = Math.max(0, Math.min(safeTotal - 1, activeIndex));

  return (
    <View style={styles.row}>
      {Array.from({ length: safeTotal }).map((_, i) => {
        const active = i === safeActive;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              active ? styles.dotActive : styles.dotInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

const makeStyles = (colors: any, layout: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    dot: {
      height: 8,
      borderRadius: 999,
    },
    dotActive: {
      width: 20,
      backgroundColor: colors.primary,
    },
    dotInactive: {
      width: 8,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },
  });
