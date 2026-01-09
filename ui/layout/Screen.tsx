// ui/layout/Screen.tsx
import React from "react";
import { ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";

export type ScreenProps = {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
};

export function Screen({ children, edges = ["top", "bottom"], style }: ScreenProps) {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
