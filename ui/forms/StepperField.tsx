// ui/forms/StepperField.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function StepperField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  format,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (n: number) => string;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.meta }}>
        {label}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: layout.radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={() => onChange(clamp(value - step, min, max))}
          style={{
            width: 56,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            borderRightWidth: 1,
            borderRightColor: colors.border,
          }}
          hitSlop={layout.hitSlop}
        >
          <Text style={{ fontSize: 22, color: colors.text, fontFamily: typography.fontFamily.bold }}>−</Text>
        </Pressable>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 28, color: colors.text, fontFamily: typography.fontFamily.bold, letterSpacing: -0.5 }}>
            {format ? format(value) : String(value)}
          </Text>
        </View>

        <Pressable
          onPress={() => onChange(clamp(value + step, min, max))}
          style={{
            width: 56,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            borderLeftWidth: 1,
            borderLeftColor: colors.border,
          }}
          hitSlop={layout.hitSlop}
        >
          <Text style={{ fontSize: 22, color: colors.text, fontFamily: typography.fontFamily.bold }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
