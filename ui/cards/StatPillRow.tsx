// ui/cards/StatPillRow.tsx
import React from "react";
import { View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { MetricChip } from "./MetricChip";

export function StatPillRow({ items }: { items: Array<{ label: string; value: string }> }) {
  const { layout } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: layout.space.sm }}>
      {items.map((it) => (
        <MetricChip key={it.label} label={it.label} value={it.value} />
      ))}
    </View>
  );
}
