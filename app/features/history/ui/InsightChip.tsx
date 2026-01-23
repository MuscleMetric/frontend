// app/features/history/ui/InsightChip.tsx
import React from "react";
import { View, Text } from "react-native";
import { Icon } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";

export type InsightTrend = "up" | "down" | "flat";

export type Insight = {
  label: string;
  trend?: InsightTrend;
};

export function InsightChip({ insight }: { insight: Insight }) {
  const { colors } = useAppTheme();

  const trend: InsightTrend = insight.trend ?? "flat";

  const bg =
    trend === "down"
      ? "rgba(239,68,68,0.12)"
      : trend === "up"
      ? "rgba(34,197,94,0.12)"
      : "rgba(148,163,184,0.12)";

  const border =
    trend === "down"
      ? "rgba(239,68,68,0.18)"
      : trend === "up"
      ? "rgba(34,197,94,0.18)"
      : "rgba(148,163,184,0.18)";

  const icon =
    trend === "down" ? "trending-down" : trend === "up" ? "trending-up" : "remove";

  const iconColor =
    trend === "down"
      ? "rgba(239,68,68,0.9)"
      : trend === "up"
      ? "rgba(34,197,94,0.9)"
      : "rgba(148,163,184,0.9)";

  return (
    <View
      style={{
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Icon name={icon as any} size={16} color={iconColor} />
      <Text style={{ marginLeft: 8, color: colors.text, fontSize: 13 }}>
        {insight.label}
      </Text>
    </View>
  );
}
