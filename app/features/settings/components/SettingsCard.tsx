// app/features/settings/components/SettingsCard.tsx
import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function SettingsCard({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const { colors, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: tone === "danger" ? "rgba(239,68,68,0.25)" : colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl ?? layout.radius.lg,
          overflow: "hidden",
        },
      }),
    [colors, layout, tone]
  );

  return <View style={styles.card}>{children}</View>;
}