// app/features/history/ui/HistorySectionHeader.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function HistorySectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fontFamily.bold,
            fontSize: 18,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: 13 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ? <View style={{ marginLeft: 12 }}>{right}</View> : null}
    </View>
  );
}
