// ui/navigation/BackButton.tsx
import React from "react";
import { Pressable, ViewStyle } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui";

export type BackButtonProps = {
  onPress?: () => void;
  variant?: "back" | "close";
};

export function BackButton({ onPress, variant = "back" }: BackButtonProps) {
  const { colors, layout } = useAppTheme();
  const icon = variant === "close" ? "close" : "chevron-back";

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={layout.hitSlop}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.cardPressed : "transparent",
        } satisfies ViewStyle,
      ]}
    >
      <Icon name={icon as any} size={22} color={colors.text} />
    </Pressable>
  );
}
