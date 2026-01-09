// ui/buttons/Button.tsx
import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  fullWidth = true,
  disabled,
  loading,
  leftIcon,
}: ButtonProps) {
  const { colors, typography, layout } = useAppTheme();

  const isGhost = variant === "ghost";
  const isSecondary = variant === "secondary";
  const isDestructive = variant === "destructive";

  const backgroundColor = isGhost || isSecondary ? "transparent" : isDestructive ? colors.danger : colors.primary;
  const borderColor = isSecondary ? colors.border : "transparent";
  const textColor = isGhost || isSecondary ? colors.text : "#FFFFFF";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          width: fullWidth ? "100%" : undefined,
          borderRadius: layout.radius.lg,
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {leftIcon ? leftIcon : null}
          <Text
            style={{
              marginLeft: leftIcon ? 10 : 0,
              fontFamily: typography.fontFamily.semibold,
              fontSize: typography.size.body,
              lineHeight: typography.lineHeight.body,
              color: textColor,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 16,
  } satisfies ViewStyle,
});
