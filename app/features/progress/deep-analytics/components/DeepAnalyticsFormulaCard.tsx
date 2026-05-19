import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";

export function DeepAnalyticsFormulaCard() {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        padding: layout.space.md,
        borderRadius: layout.radius.lg,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: layout.space.xs,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 15,
        }}
      >
        How estimated 1RM is calculated
      </Text>

      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: 13,
          lineHeight: 19,
        }}
      >
        MuscleMetric uses the Epley formula: weight × (1 + reps / 30). It is
        best used for normal strength sets between 1 and 15 reps.
      </Text>
    </View>
  );
}