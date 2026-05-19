import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { VolumeBarsChart } from "../charts/VolumeBarsChart";
import { generateVolumeInsight } from "../utils/deepAnalyticsInsights";
import { ConfidencePill } from "./ConfidencePill";

type Props = {
  payload: DeepAnalyticsPayload;
};

export function VolumeTrendSection({ payload }: Props) {
  const { colors, typography, layout } = useAppTheme();
  const insight = generateVolumeInsight(payload);

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
          Volume trend
        </Text>

        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.regular,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          Shows total work performed each session.
        </Text>
      </View>

      {insight ? (
        <View style={{ gap: layout.space.xs }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 14,
            }}
          >
            {insight.title}
          </Text>

          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fontFamily.regular,
              fontSize: 13,
              lineHeight: 18,
            }}
          >
            {insight.description}
          </Text>

          <ConfidencePill confidence={insight.confidence} />
        </View>
      ) : null}

      <VolumeBarsChart data={payload.charts.volume_trend} />
    </View>
  );
}