import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui";

export function LiveWorkoutTopBar({
  title,
  onBack,
  onMore,
}: {
  title: string;
  onBack: () => void;
  onMore: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        paddingHorizontal: layout.space.lg,
        paddingTop: layout.space.lg,
        paddingBottom: layout.space.md,
        backgroundColor: colors.bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Pressable onPress={onBack} style={{ padding: 8 }}>
        <Icon name="chevron-back" size={22} color={colors.text} />
      </Pressable>

      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          marginHorizontal: layout.space.sm,
          textAlign: "center",
          fontFamily: typography.fontFamily.semibold,
          color: colors.text,
        }}
      >
        {title}
      </Text>

      <Pressable onPress={onMore} style={{ padding: 8 }}>
        <Icon name="ellipsis-horizontal" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}
