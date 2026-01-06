import React, { useMemo } from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { homeTokens } from "./homeTheme";

export function BaseCard({
  children,
  onPress,
  style,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  tone?: "default" | "hero";
}) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  const pressable = !!onPress && !disabled;

  const baseStyle: ViewStyle = {
    borderRadius: 22,
    padding: 18,
    backgroundColor: tone === "hero" ? "transparent" : t.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.cardBorder,
    shadowColor: "#000",
    ...t.shadow,
  };

  if (!pressable) return <View style={[baseStyle, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        baseStyle,
        style,
        pressed ? { transform: [{ scale: 0.992 }], opacity: 0.98 } : null,
      ]}
      android_ripple={{ color: "#00000010" }}
      hitSlop={10}
    >
      {children}
    </Pressable>
  );
}
