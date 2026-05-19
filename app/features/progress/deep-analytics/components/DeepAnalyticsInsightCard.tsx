import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsInsight } from "../types";
import { ConfidencePill } from "./ConfidencePill";

type Props = {
  insight: DeepAnalyticsInsight;
};

export function DeepAnalyticsInsightCard({ insight }: Props) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        padding: layout.space.lg,
        borderRadius: layout.radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary,
        gap: layout.space.sm,
      }}
    >
      <View style={{ gap: layout.space.xs }}>
        <Text
          style={{
            color: colors.primary,
            fontFamily: typography.fontFamily.bold,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Training insight
        </Text>

        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fontFamily.bold,
            fontSize: 20,
            letterSpacing: -0.2,
          }}
        >
          {insight.title}
        </Text>
      </View>

      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        {insight.description}
      </Text>

      <ConfidencePill confidence={insight.confidence} />
    </View>
  );
}