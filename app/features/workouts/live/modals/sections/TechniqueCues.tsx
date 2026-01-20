// live/modals/sections/TechniqueCues.tsx
import React from "react";
import { View, Text } from "react-native";

export function TechniqueCues(props: {
  colors: any;
  typography: any;
  instructions?: string | null;
}) {
  const { colors, typography, instructions } = props;
  if (!instructions) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 }}>
      <Text style={{ color: colors.textMuted, fontSize: typography.size.sub, marginBottom: 6 }}>
        Technique cues
      </Text>
      <Text style={{ color: colors.text, lineHeight: 20 }}>{instructions}</Text>
    </View>
  );
}
