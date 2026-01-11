// ui/buttons/Button.tsx
import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  View,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "text"
  | "destructive"
  | "outline";
export type ButtonTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
};

function toneColor(colors: any, tone: ButtonTone) {
  switch (tone) {
    case "success":
      return colors.success ?? colors.primary;
    case "warning":
      return colors.warning ?? colors.primary;
    case "danger":
      return colors.danger ?? colors.primary;
    case "neutral":
      return colors.textMuted ?? colors.text;
    case "primary":
    default:
      return colors.primary;
  }
}

export function Button({
  title,
  onPress,
  variant = "primary",
  tone = "primary",
  fullWidth = true,
  disabled,
  loading,
  leftIcon,
}: ButtonProps) {
  const { colors, typography, layout } = useAppTheme();

  const isText = variant === "text";
  const isGhost = variant === "ghost";
  const isSecondary = variant === "secondary";
  const isDestructive = variant === "destructive";

  const t = isDestructive
    ? colors.danger ?? colors.primary
    : toneColor(colors, tone);

  const isOutline = variant === "outline";

  const backgroundColor =
    isOutline || isGhost || isSecondary
      ? "transparent"
      : isDestructive
      ? colors.danger
      : colors.primary;

  const borderColor = isOutline
    ? colors.border
    : isSecondary
    ? colors.border
    : "transparent";

  const textColor = isOutline
    ? colors.text
    : isGhost || isSecondary
    ? colors.text
    : "#FFFFFF";

  const height = isText ? 44 : 52; // text button feels lighter but still tappable
  const borderWidth = isText ? 0 : 1;
  const paddingHorizontal = isText ? 8 : 16;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          width: fullWidth ? "100%" : undefined,
          borderRadius: layout.radius.lg,
          backgroundColor,
          borderColor,
          borderWidth,
          paddingHorizontal,
          opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
        },
        isText ? styles.textBtn : null,
      ]}
      hitSlop={isText ? 8 : 0}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.inner}>
          {leftIcon ? (
            <View style={{ marginRight: 10 }}>{leftIcon}</View>
          ) : null}
          <Text
            style={{
              fontFamily: typography.fontFamily.semibold,
              fontSize: typography.size.body,
              lineHeight: typography.lineHeight.body,
              color: textColor,
              textAlign: "center",
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,

  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,

  textBtn: {
    borderRadius: 999, // feels like a "link pill" without border
  } satisfies ViewStyle,
});
