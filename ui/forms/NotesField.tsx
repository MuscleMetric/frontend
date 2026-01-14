// ui/forms/NotesField.tsx
import React from "react";
import { View, Text, TextInput } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function NotesField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.meta }}>
        {label}
      </Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: layout.radius.xl,
          backgroundColor: colors.surface,
          padding: layout.space.md,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          style={{
            minHeight: 80,
            color: colors.text,
            fontFamily: typography.fontFamily.regular,
            fontSize: typography.size.body,
            lineHeight: typography.lineHeight.body,
          }}
        />
      </View>
    </View>
  );
}
