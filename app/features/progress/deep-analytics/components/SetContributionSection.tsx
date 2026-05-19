import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { SetContributionBarsChart } from "../charts/SetContributionBarsChart";

type Props = {
  payload: DeepAnalyticsPayload;
};

export function SetContributionSection({ payload }: Props) {
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
          Set contribution
        </Text>

        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.regular,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          Shows which sets contributed most to your total session volume.
        </Text>
      </View>

      <SetContributionBarsChart data={payload.charts.set_contribution} />
    </View>
  );
}