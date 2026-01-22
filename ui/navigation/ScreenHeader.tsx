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

export function ScreenHeader({
  title,
  showBack = true,
  right,
}: ScreenHeaderProps) {
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
      <View style={styles.container}>
        {/* Left slot */}
        <View style={styles.side}>
          {showBack ? <BackButton /> : null}
        </View>

        {/* Center title (absolute, true center) */}
        <View pointerEvents="none" style={styles.center}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: typography.fontFamily.semibold,
              fontSize: typography.size.h2,
              lineHeight: typography.lineHeight.h2,
              color: colors.text,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
        </View>

        {/* Right slot */}
        <View style={styles.sideRight}>
          {right}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 10,
  },

  container: {
    height: 44,
    justifyContent: "center",
  },

  side: {
    position: "absolute",
    left: 0,
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  sideRight: {
    position: "absolute",
    right: 0,
    width: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  center: {
    position: "absolute",
    left: 44,
    right: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
