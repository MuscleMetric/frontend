import React, { useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export type PillTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export type PillVariant = "default" | "inverted";

export function Pill({
  label,
  tone = "neutral",
  variant = "default",
  style,
}: {
  label: string;
  tone?: PillTone;
  variant?: PillVariant;
  style?: ViewStyle;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () => makeStyles(colors, typography, layout, tone, variant),
    [colors, typography, layout, tone, variant]
  );

  return (
    <View style={[styles.wrap, style]}>
      <Text numberOfLines={1} style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (
  colors: any,
  typography: any,
  layout: any,
  tone: PillTone,
  variant: PillVariant
) => {
  // ---------- DEFAULT (on surface) ----------
  const defaultTint =
    tone === "primary"
      ? "rgba(37,99,235,0.14)"
      : tone === "success"
      ? "rgba(34,197,94,0.14)"
      : tone === "warning"
      ? "rgba(245,158,11,0.14)"
      : tone === "danger"
      ? "rgba(239,68,68,0.14)"
      : colors.cardPressed;

  const defaultBorder =
    tone === "primary"
      ? "rgba(37,99,235,0.24)"
      : tone === "success"
      ? "rgba(34,197,94,0.24)"
      : tone === "warning"
      ? "rgba(245,158,11,0.24)"
      : tone === "danger"
      ? "rgba(239,68,68,0.24)"
      : colors.border;

  const defaultText =
    tone === "primary"
      ? colors.primary
      : tone === "success"
      ? colors.success
      : tone === "warning"
      ? colors.warning
      : tone === "danger"
      ? colors.danger
      : colors.text;

  // ---------- INVERTED (on image / dark overlay) ----------
  const invertedTint = "rgba(255,255,255,0.16)";
  const invertedBorder = "rgba(255,255,255,0.28)";
  const invertedText = colors.onPrimary ?? "#FFFFFF";

  const isInverted = variant === "inverted";

  return StyleSheet.create({
    wrap: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: layout.radius.pill,
      backgroundColor: isInverted ? invertedTint : defaultTint,
      borderColor: isInverted ? invertedBorder : defaultBorder,
      borderWidth: StyleSheet.hairlineWidth,
    },
    text: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: isInverted ? invertedText : defaultText,
      letterSpacing: 0.2,
    },
  });
};
