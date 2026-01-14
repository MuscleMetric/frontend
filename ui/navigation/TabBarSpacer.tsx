// ui/navigation/TabBarSpacer.tsx
import React from "react";
import { View } from "react-native";

export function TabBarSpacer({ height = 64 }: { height?: number }) {
  return <View style={{ height }} />;
}
