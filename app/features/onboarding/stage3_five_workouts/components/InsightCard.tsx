import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function InsightCard({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      width: "100%",
      borderRadius: layout.radius.xl,
      backgroundColor: colors.trackBg, // subtle “glass” feel without custom rgba
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      paddingVertical: layout.space.lg,
      paddingHorizontal: layout.space.lg,
      alignItems: "center",
    },
    title: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.h3,
      lineHeight: typography.lineHeight.h3,
      textAlign: "center",
      letterSpacing: -0.2,
    },
    sub: {
      marginTop: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      textAlign: "center",
      maxWidth: 360,
    },
  });
