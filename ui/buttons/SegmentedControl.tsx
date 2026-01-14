// ui/buttons/SegmentedControl.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: layout.radius.xl,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: layout.radius.lg,
              backgroundColor: active ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: typography.fontFamily.semibold,
                color: active ? colors.onPrimary : colors.textMuted,
                fontSize: typography.size.meta,
              }}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
