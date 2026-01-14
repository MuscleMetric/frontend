// ui/forms/ToggleRow.tsx
import React from "react";
import { View, Text, Switch } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  return (
    <View
      style={{
        padding: layout.space.md,
        borderRadius: layout.radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.text, fontFamily: typography.fontFamily.semibold }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
