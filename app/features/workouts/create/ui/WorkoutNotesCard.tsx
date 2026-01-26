import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card } from "@/ui";

export default function WorkoutNotesCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = makeStyles(colors, typography, layout);

  return (
    <Card>
      <View style={{ gap: layout.space.xs }}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Optional notes for this workout…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
        />
      </View>
    </Card>
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
      minHeight: 84,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      paddingHorizontal: layout.space.md,
      paddingVertical: 12,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },
  });
