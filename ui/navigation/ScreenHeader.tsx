// ui/navigation/ScreenHeader.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { BackButton } from "@/ui";

export type ScreenHeaderProps = {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, showBack = true, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + layout.space.sm,
          paddingHorizontal: layout.space.lg,
          backgroundColor: colors.bg,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={{ width: 44 }}>{showBack ? <BackButton /> : null}</View>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.size.h2,
            lineHeight: typography.lineHeight.h2,
            color: colors.text,
          }}
        >
          {title}
        </Text>

        <View style={{ width: 44, alignItems: "flex-end" }}>{right ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 10,
  },
  row: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
