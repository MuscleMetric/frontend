import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

export function SavedPill({
  text = "Saved",
}: {
  text?: string;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  return (
    <View style={styles.wrap}>
      <Icon name="checkmark-circle" size={18} color={colors.success} />
      <Text style={styles.text}>{text}</Text>
      <Icon name="checkmark" size={16} color={colors.success} />
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    wrap: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.successBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(34,197,94,0.35)",
    },
    text: {
      color: colors.success,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 14,
      letterSpacing: 0.2,
    },
  });
