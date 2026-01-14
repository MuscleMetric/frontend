// ui/navigation/HeaderAction.tsx
import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

export function HeaderAction({
  label,
  icon,
  onPress,
  tone = "default",
  style,
}: {
  label?: string;
  icon?: string;
  onPress: () => void;
  tone?: "default" | "primary" | "danger";
  style?: ViewStyle;
}) {
  const { colors, typography, layout } = useAppTheme();

  const tint =
    tone === "primary" ? colors.primary : tone === "danger" ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={layout.hitSlop}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: layout.radius.pill,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon as any} size={18} color={tint} /> : null}
      {label ? (
        <Text style={{ color: tint, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.meta }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
