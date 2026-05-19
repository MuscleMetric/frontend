import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { StrengthOverTimeChart } from "../charts/StrengthOverTimeChart";
import { generatePrimaryInsight } from "../utils/deepAnalyticsInsights";
import { ConfidencePill } from "./ConfidencePill";

type Props = {
  payload: DeepAnalyticsPayload;
};

export function StrengthOverTimeSection({ payload }: Props) {
  const { colors, typography, layout } = useAppTheme();
  const insight = generatePrimaryInsight(payload);

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
          Strength over time
        </Text>

        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.regular,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          Tracks your top estimated strength across sessions.
        </Text>
      </View>

      <ConfidencePill confidence={insight.confidence} />

      <StrengthOverTimeChart data={payload.charts.progress_over_time ?? []} />
    </View>
  );
}