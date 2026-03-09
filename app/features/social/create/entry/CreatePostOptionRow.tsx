// app/features/social/create/entry/CreatePostOptionRow.tsx

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

type Props = {
  title: string;
  subtitle: string;
  iconName: string; // keep generic to match your Icon system
  onPress: () => void;
};

export default function CreatePostOptionRow({
  title,
  subtitle,
  iconName,
  onPress,
}: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        iconWrap: {
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        },
        textWrap: {
          flex: 1,
        },
        title: {
          fontSize: typography.size.body,
          fontWeight: "600",
          color: colors.text,
          marginBottom: 2,
        },
        subtitle: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
        },
        chevron: {
          marginLeft: 10,
        },
      }),
    [colors, typography]
  );

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconWrap}>
        <Icon name={iconName as any} size={18} color={colors.text} />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.chevron}>
        <Icon name={"chevron-forward" as any} size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}