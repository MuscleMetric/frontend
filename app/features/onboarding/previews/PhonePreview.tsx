// app/features/onboarding/previews/PhonePreview.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

export function PhonePreview({
  children,
  height,
}: {
  children: React.ReactNode;
  height?: number;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
        height ? { height } : styles.fill,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  // key bit: if you don't pass height, it grows naturally
  fill: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 420,
  },
});
