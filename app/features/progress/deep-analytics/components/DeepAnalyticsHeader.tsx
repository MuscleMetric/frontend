import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";

type Props = {
  payload: DeepAnalyticsPayload;
};

export function DeepAnalyticsHeader({ payload }: Props) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View style={{ gap: layout.space.xs }}>
      <Text
        style={{
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 28,
          letterSpacing: -0.4,
        }}
      >
        {payload.meta.exercise_name}
      </Text>

      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: 14,
        }}
      >
        Logged trends · Estimated strength, volume and set summaries
      </Text>
    </View>
  );
}
