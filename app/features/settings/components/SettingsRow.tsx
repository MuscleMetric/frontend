// app/features/settings/components/SettingsRow.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ChevronRight } from "lucide-react-native";

export function SettingsRow({
  label,
  value,
  onPress,
  tone = "default",
  last = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: "default" | "danger";
  last?: boolean;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          paddingHorizontal: layout.space.lg,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          backgroundColor: colors.surface,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        left: { flex: 1 },
        label: {
          color: tone === "danger" ? colors.danger : colors.text,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
        },
        right: { flexDirection: "row", alignItems: "center", gap: 8 },
        value: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },
        chevron: { opacity: 0.6 },
      }),
    [colors, typography, layout, tone, last]
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed && onPress ? 0.6 : 1 },
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View style={styles.right}>
        {!!value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {onPress ? (
          <ChevronRight size={18} color={colors.textMuted} style={styles.chevron} />
        ) : null}
      </View>
    </Pressable>
  );
}