import React from "react";
import { View, Pressable, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export type CardVariant = "default" | "pressable" | "primary";

export type CardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
};

export function Card({
  children,
  variant = "default",
  onPress,
  style,
  padded = true,
}: CardProps) {
  const { colors, layout } = useAppTheme();

  const baseStyle: ViewStyle = {
    borderRadius: layout.radius.xl,
    padding: padded ? layout.space.lg : 0,
  };

  // --- variant styles ---
  const variantStyle: ViewStyle =
    variant === "primary"
      ? {
          backgroundColor: colors.primary,
          borderWidth: 0,
        }
      : {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
        };

  if (variant === "pressable") {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          variantStyle,
          {
            backgroundColor: pressed
              ? colors.cardPressed
              : variantStyle.backgroundColor,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, variantStyle, style]}>{children}</View>;
}
