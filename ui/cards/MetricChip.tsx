// ui/cards/MetricChip.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export type MetricChipItem = {
  label: string;
  value: string;
};

export function MetricChip({
  item,
  borderless = false,
}: {
  item: MetricChipItem;
  borderless?: boolean;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        flexGrow: 1,
        flexShrink: 1,

        paddingHorizontal: layout.space.lg,
        paddingVertical: layout.space.md,
        borderRadius: layout.radius.xl,

        backgroundColor: borderless ? colors.trackBg : colors.surface,
        borderWidth: borderless ? 0 : 1,
        borderColor: borderless ? "transparent" : colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          color: colors.textMuted,
        }}
        numberOfLines={1}
      >
        {item.label}
      </Text>

      <Text
        style={{
          marginTop: 2,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          color: colors.text,
        }}
        numberOfLines={1}
      >
        {item.value}
      </Text>
    </View>
  );
}
