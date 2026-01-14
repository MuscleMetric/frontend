// ui/buttons/IconButton.tsx
import React from "react";
import { Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

export function IconButton({
  icon,
  onPress,
  tone = "default",
}: {
  icon: string;
  onPress: () => void;
  tone?: "default" | "primary" | "danger";
}) {
  const { colors, layout } = useAppTheme();
  const tint = tone === "primary" ? colors.primary : tone === "danger" ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={layout.hitSlop}
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Icon name={icon as any} size={18} color={tint} />
    </Pressable>
  );
}
