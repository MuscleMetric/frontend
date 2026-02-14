// app/features/social/SocialScreen.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export default function SocialScreen() {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: layout.space.lg }}>
      <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.h1 }}>
        Social
      </Text>
      <Text style={{ marginTop: 6, color: colors.textMuted, fontFamily: typography.fontFamily.regular, fontSize: typography.size.body }}>
        Feed coming next.
      </Text>
    </View>
  );
}