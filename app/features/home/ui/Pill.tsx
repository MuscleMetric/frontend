import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { homeTokens } from "./homeTheme";

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "primary" | "blue" | "green" | "amber" | "red";
}) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);
  const s = (t.pill as any)[tone];

  return (
    <View style={[styles.wrap, { backgroundColor: s.bg, borderColor: s.bd }]}>
      <Text style={[styles.text, { color: s.tx }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontWeight: "800", fontSize: 12, letterSpacing: 0.4 },
});
