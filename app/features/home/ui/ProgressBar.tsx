import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { homeTokens } from "./homeTheme";

export function ProgressBar({ valuePct }: { valuePct: number }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  const v = Math.max(0, Math.min(100, valuePct));

  return (
    <View style={[styles.track, { backgroundColor: t.track, borderColor: t.cardBorder }]}>
      <View style={[styles.fill, { width: `${v}%`, backgroundColor: t.fill }]} />
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
  fill: { height: "100%", borderRadius: 999 },
});
