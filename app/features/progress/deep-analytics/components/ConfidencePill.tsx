import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { Confidence } from "../types";

type Props = {
  confidence: Confidence;
};

export function ConfidencePill({ confidence }: Props) {
  const { colors, typography, layout } = useAppTheme();

  const label =
    confidence === "high"
      ? "High confidence"
      : confidence === "medium"
        ? "Medium confidence"
        : "Low confidence";

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: layout.space.sm,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          color: colors.bg,
          fontFamily: typography.fontFamily.medium,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}