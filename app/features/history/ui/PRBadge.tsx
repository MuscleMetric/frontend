// app/features/history/ui/PRBadge.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function PRBadge({ label = "PR" }: { label?: string }) {
  const { colors, typography } = useAppTheme();

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(34,197,94,0.14)",
        borderWidth: 1,
        borderColor: "rgba(34,197,94,0.22)",
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
