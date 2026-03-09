// app/features/settings/components/ToggleRow.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  last = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
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
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        left: { flex: 1 },
        label: {
          color: colors.text,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
        },
        desc: {
          marginTop: 4,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },
      }),
    [colors, typography, layout, last]
  );

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {!!description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>

      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}