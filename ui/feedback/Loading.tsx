// ui/feedback/Loading.tsx
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function Loading({ fullScreen }: { fullScreen?: boolean }) {
  const { colors } = useAppTheme();

  if (fullScreen) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <ActivityIndicator />;
}
