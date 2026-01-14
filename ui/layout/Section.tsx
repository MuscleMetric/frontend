// ui/layout/Section.tsx
import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function Section({
  title,
  right,
  children,
  style,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View style={[{ gap: layout.space.sm }, style]}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{
              fontFamily: typography.fontFamily.bold,
              fontSize: typography.size.h2,
              lineHeight: typography.lineHeight.h2,
              color: colors.text,
            }}
          >
            {title}
          </Text>
          {right ? <View>{right}</View> : null}
        </View>
      ) : null}

      {children}
    </View>
  );
}
