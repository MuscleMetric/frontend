// ui/layout/Divider.tsx
import React from "react";
import { View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        marginLeft: inset,
        marginRight: inset,
      }}
    />
  );
}
