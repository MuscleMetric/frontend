// app/features/settings/components/SectionHeader.tsx
import React, { useMemo } from "react";
import { Text, StyleSheet, View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function SectionHeader({
  title,
  tone = "default",
}: {
  title: string;
  tone?: "default" | "danger";
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { paddingHorizontal: 2, marginTop: 6 },
        text: {
          color: tone === "danger" ? colors.danger : colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        },
      }),
    [colors, typography, tone]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}