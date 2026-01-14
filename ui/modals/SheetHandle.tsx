// ui/modals/SheetHandle.tsx
import React from "react";
import { View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function SheetHandle() {
  const { colors, layout } = useAppTheme();
  return (
    <View style={{ alignItems: "center", paddingTop: layout.space.sm, paddingBottom: layout.space.sm }}>
      <View
        style={{
          width: 46,
          height: 5,
          borderRadius: 999,
          backgroundColor: colors.border,
          opacity: 0.7,
        }}
      />
    </View>
  );
}
