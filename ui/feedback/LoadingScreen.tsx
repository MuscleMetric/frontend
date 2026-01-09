// ui/feedback/LoadingScreen.tsx
import React from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function LoadingScreen({ message }: { message?: string }) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator />
      {message ? (
        <Text
          style={{
            marginTop: 12,
            color: colors.textMuted,
            fontFamily: typography.fontFamily.medium,
            fontSize: typography.size.sub,
          }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
