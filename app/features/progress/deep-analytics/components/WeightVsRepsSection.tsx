import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { WeightVsRepsScatterChart } from "../charts/WeightVsRepsScatterChart";

type Props = {
  payload: DeepAnalyticsPayload;
};

export function WeightVsRepsSection({ payload }: Props) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        padding: layout.space.lg,
        borderRadius: layout.radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: layout.space.md,
      }}
    >
      <View style={{ gap: layout.space.xs }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fontFamily.bold,
            fontSize: 18,
          }}
        >
          Weight vs reps
        </Text>

        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.regular,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          Shows how your working sets are distributed across heavier and higher-rep work.
        </Text>
      </View>

      <WeightVsRepsScatterChart data={payload.charts.weight_vs_reps} />
    </View>
  );
}