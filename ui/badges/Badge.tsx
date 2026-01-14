// ui/badges/Badge.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "primary" | "danger" | "success";
}) {
  const { colors, typography, layout } = useAppTheme();

  const bg =
    tone === "primary"
      ? "rgba(37,99,235,0.10)"
      : tone === "success"
      ? colors.successBg
      : tone === "danger"
      ? "rgba(239,68,68,0.10)"
      : colors.trackBg;

  const fg =
    tone === "primary"
      ? colors.primary
      : tone === "success"
      ? colors.success
      : tone === "danger"
      ? colors.danger
      : colors.textMuted;

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: layout.radius.pill,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <Text style={{ color: fg, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.meta }}>
        {label}
      </Text>
    </View>
  );
}
