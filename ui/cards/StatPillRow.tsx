// ui/cards/StatPillRow.tsx
import React from "react";
import { View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { MetricChip, type MetricChipItem } from "./MetricChip";

export function StatPillRow({
  items,
  borderless = false,
}: {
  items: MetricChipItem[];
  borderless?: boolean;
}) {
  const { layout } = useAppTheme();

  if (!items?.length) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: layout.space.xs,
      }}
    >
      {items.slice(0, 3).map((it) => (
        <MetricChip key={it.label} item={it} borderless={borderless} />
      ))}
    </View>
  );
}
