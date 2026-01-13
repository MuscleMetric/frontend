// ui/cards/ListRow.tsx
import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui";

export type ListRowTone = "default" | "success";

export type ListRowProps = {
  title: string;
  subtitle?: string;
  rightText?: string;
  rightNode?: React.ReactNode;
  onPress?: () => void;
  left?: React.ReactNode;
  showChevron?: boolean;
  disabled?: boolean;
  tone?: ListRowTone;
};

export function ListRow({
  title,
  subtitle,
  rightText,
  rightNode,
  onPress,
  left,
  showChevron = true,
  disabled = false,
  tone = "default",
}: ListRowProps) {
  const { colors, typography, layout } = useAppTheme();

  const bg =
    tone === "success" ? colors.successBg ?? colors.trackBg : colors.surface;
  const border =
    tone === "success" ? colors.success ?? colors.border : colors.border;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: layout.space.md,
          paddingHorizontal: layout.space.lg,
          backgroundColor: pressed && !disabled ? colors.cardPressed : bg,
          borderColor: border,
          opacity: disabled ? 0.95 : 1,
        },
      ]}
    >
      {left ? <View style={{ marginRight: 12 }}>{left}</View> : null}

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.size.body,
            color: colors.text,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 2,
              fontFamily: typography.fontFamily.regular,
              fontSize: typography.size.sub,
              color: colors.textMuted,
            }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightNode ? (
        <View style={{ marginLeft: 10 }}>{rightNode}</View>
      ) : rightText ? (
        <Text
          style={{
            marginRight: showChevron ? 8 : 0,
            fontFamily: typography.fontFamily.medium,
            fontSize: typography.size.sub,
            color: colors.textMuted,
          }}
        >
          {rightText}
        </Text>
      ) : null}

      {showChevron && !disabled ? (
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
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
