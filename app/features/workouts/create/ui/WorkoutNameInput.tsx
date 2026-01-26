import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export default function WorkoutNameInput({
  value,
  onChange,
  placeholder = "Workout name (e.g. Push A)",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = makeStyles(colors, typography, layout);

  return (
    <View style={{ gap: layout.space.xs }}>
      <Text style={styles.label}>Workout name</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="done"
      />
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    label: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      paddingHorizontal: layout.space.md,
      paddingVertical: 12,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },
  });
