// ui/feedback/ErrorState.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Button } from "@/ui";

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
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

      {onRetry ? (
        <View style={{ marginTop: layout.space.lg, width: "100%" }}>
          <Button title="Retry" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
