import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { homeTokens } from "./homeTheme";

export function ProgressBar({ valuePct }: { valuePct: number }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  const v = Math.max(0, Math.min(100, Number(valuePct ?? 0)));

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: t.trackBg, // ✅ exists
          borderColor: t.trackBorder, // ✅ exists
        },
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${v}%`,
            backgroundColor: t.primary, // ✅ exists
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});
