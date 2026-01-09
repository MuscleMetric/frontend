// ui/cards/ListRow.tsx
import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui";

export type ListRowProps = {
  title: string;
  subtitle?: string;
  rightText?: string;
  onPress?: () => void;
  left?: React.ReactNode;
  showChevron?: boolean;
};

export function ListRow({
  title,
  subtitle,
  rightText,
  onPress,
  left,
  showChevron = true,
}: ListRowProps) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: layout.space.md,
          paddingHorizontal: layout.space.lg,
          backgroundColor: pressed ? colors.cardPressed : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {left ? <View style={{ marginRight: 12 }}>{left}</View> : null}

      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body, color: colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: 2, fontFamily: typography.fontFamily.regular, fontSize: typography.size.sub, color: colors.textMuted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightText ? (
        <Text style={{ marginRight: showChevron ? 8 : 0, fontFamily: typography.fontFamily.medium, fontSize: typography.size.sub, color: colors.textMuted }}>
          {rightText}
        </Text>
      ) : null}

      {showChevron ? <Icon name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
  },
});
