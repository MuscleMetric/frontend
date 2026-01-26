import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export default function CreateWorkoutHeader({
  title = "Create workout",
  subtitle = "Add exercises and save when you’re ready.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = makeStyles(colors, typography, layout);

  return (
    <View style={{ gap: layout.space.xs }}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      color: colors.text,
      letterSpacing: -0.2,
    },
    sub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },
  });
