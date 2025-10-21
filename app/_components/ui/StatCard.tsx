import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";

export default function StatCard({
  value,
  label,
  tint,
}: {
  value: string | number;
  label: string;
  tint?: string;
}) {

  const { colors } = useTheme();

  return (
    <View style={[styles.card, tint ? { backgroundColor: tint } : null]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#eef2f6",
    alignItems: "center",
  },
  value: { fontSize: 28, fontWeight: "900", marginBottom: 2 },
  label: { color: "#6b7280", fontWeight: "500" },
});
