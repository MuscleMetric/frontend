// app/features/workouts/live/components/LiveHeader.tsx
import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { IconButton, HeaderAction } from "@/ui";

export function LiveHeader({
  title,
  timerText,
  progressText,
  onBack,
  onMore,
}: {
  title: string;
  timerText?: string;     // e.g. "12:40"
  progressText?: string;  // e.g. "3 / 8"
  onBack: () => void;
  onMore: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        paddingTop: insets.top + layout.space.sm,
        paddingBottom: layout.space.md,
        paddingHorizontal: layout.space.lg,
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: layout.space.sm }}>
        <IconButton icon="chevron-back" onPress={onBack} />

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: typography.fontFamily.semibold,
              fontSize: typography.size.h2,
              lineHeight: typography.lineHeight.h2,
              color: colors.text,
            }}
          >
            {title}
          </Text>

          {/* Tiny meta row */}
          {(timerText || progressText) ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontFamily: typography.fontFamily.medium,
                fontSize: typography.size.meta,
                color: colors.textMuted,
              }}
            >
              {timerText ? timerText : ""}
              {timerText && progressText ? " • " : ""}
              {progressText ? progressText : ""}
            </Text>
          ) : null}
        </View>

        <HeaderAction icon="ellipsis-horizontal" onPress={onMore} />
      </View>
    </View>
  );
}
