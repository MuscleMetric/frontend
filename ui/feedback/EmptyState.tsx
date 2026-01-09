// ui/feedback/EmptyState.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Button } from "@/ui";

export function EmptyState({
  title,
  message,
  ctaLabel,
  onCta,
}: {
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View style={{ padding: layout.space.xl, alignItems: "center" }}>
      <Text style={{ fontFamily: typography.fontFamily.semibold, fontSize: typography.size.h2, color: colors.text }}>
        {title}
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        {message}
      </Text>

      {ctaLabel && onCta ? (
        <View style={{ marginTop: layout.space.lg, width: "100%" }}>
          <Button title={ctaLabel} onPress={onCta} />
        </View>
      ) : null}
    </View>
  );
}
