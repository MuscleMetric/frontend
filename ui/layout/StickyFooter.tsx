// ui/layout/StickyFooter.tsx
import React from "react";
import { View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";

export function StickyFooter({
  children,
  paddingHorizontal,
}: {
  children: React.ReactNode;
  paddingHorizontal?: number;
}) {
  const insets = useSafeAreaInsets();
  const { colors, layout } = useAppTheme();

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: paddingHorizontal ?? layout.space.lg,
        paddingTop: layout.space.sm,
        paddingBottom: Math.max(insets.bottom, layout.space.md),
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        ...(Platform.OS === "ios"
          ? {
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: -6 },
            }
          : { elevation: 8 }),
      }}
    >
      {children}
    </View>
  );
}
