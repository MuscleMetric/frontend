import React from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";

export default function PlanRow({
  title,
  subtitle,
  status,
  statusColor,
  onPress,
}: {
  title: string;
  subtitle: string;
  status: string;
  statusColor: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtle}>{subtitle}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
        <Text style={{ color: statusColor, fontWeight: "700" }}>{status}</Text>
      </View>
      <Text style={styles.chevron}>{">"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  title: { fontWeight: "800", marginBottom: 4 },
  subtle: { color: "#6b7280", fontSize: 13 },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chevron: { fontSize: 18, color: "#9ca3af", marginLeft: 8 },
});
