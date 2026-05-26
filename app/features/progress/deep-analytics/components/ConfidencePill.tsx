import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

type Confidence = "low" | "medium" | "high";

export function ConfidencePill({ confidence }: { confidence?: Confidence }) {
  const { colors, typography } = useAppTheme();

  const value = confidence ?? "low";

  const label =
    value === "high"
      ? "High confidence"
      : value === "medium"
        ? "Medium confidence"
        : "Low confidence";

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: 12,
          lineHeight: 16,
        }}
      >
        {label}
      </Text>
    </View>
  );
}