// ui/layout/SafeScroll.tsx
import React from "react";
import { ScrollView, ScrollViewProps } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function SafeScroll({
  children,
  contentPaddingBottom = 0,
  ...props
}: ScrollViewProps & { contentPaddingBottom?: number }) {
  const { colors, layout } = useAppTheme();

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.bg }, props.style]}
      contentContainerStyle={[
        {
          padding: layout.space.lg,
          paddingBottom: layout.space.lg + contentPaddingBottom,
          gap: layout.space.md,
        },
        props.contentContainerStyle as any,
      ]}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
