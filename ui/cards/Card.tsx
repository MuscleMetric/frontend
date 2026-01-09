// ui/cards/Card.tsx
import React from "react";
import { View, Pressable, StyleSheet, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export type CardVariant = "default" | "pressable";

export type CardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
};

export function Card({ children, variant = "default", onPress, style, padded = true }: CardProps) {
  const { colors, layout } = useAppTheme();

  const baseStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: layout.radius.xl,
    padding: padded ? layout.space.lg : 0,
  };

  if (variant === "pressable") {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          { backgroundColor: pressed ? colors.cardPressed : colors.surface },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}
