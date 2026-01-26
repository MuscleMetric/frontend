import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export default function EmptyExercisesState({
  onAdd,
}: {
  onAdd: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = makeStyles(colors, typography, layout);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>No exercises yet</Text>
      <Text style={styles.sub}>Add a few exercises to build your workout.</Text>

      <Pressable onPress={onAdd} style={styles.cta}>
        <Text style={styles.ctaText}>Add exercises</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    box: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      gap: 8,
    },
    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },
    sub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },
    cta: {
      marginTop: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.primaryBg ?? colors.card,
    },
    ctaText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.text,
    },
  });
