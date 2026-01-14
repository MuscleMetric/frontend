// ui/cards/MetricChip.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function MetricChip({ label, value }: { label: string; value: string }) {
  const { colors, typography, layout } = useAppTheme();
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: layout.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        minWidth: 110,
      }}
    >
      <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.meta }}>
        {label}
      </Text>
      <Text style={{ marginTop: 2, color: colors.text, fontFamily: typography.fontFamily.semibold }}>
        {value}
      </Text>
    </View>
  );
}
