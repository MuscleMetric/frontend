// ui/forms/SmallNumberInput.tsx
import React from "react";
import { View, Text, TextInput } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function SmallNumberInput({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  suffix?: string;
}) {
  const { colors, typography, layout } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.meta }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: layout.radius.lg,
          backgroundColor: colors.surface,
          paddingHorizontal: layout.space.md,
          height: 44,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            color: colors.text,
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.size.body,
          }}
        />
        {suffix ? (
          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.meta }}>
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
