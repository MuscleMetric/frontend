import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";

export default function SettingRow({
  icon,
  title,
  right,
  onPress,
  chevron,
}: {
  icon: string;
  title: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {right}
      {chevron && <Text style={styles.chevron}>{">"}</Text>}
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
    gap: 12,
  },
  icon: { fontSize: 18, width: 24, textAlign: "center" },
  title: { flex: 1, fontSize: 16 },
  chevron: { fontSize: 18, color: "#9ca3af", marginLeft: 8 },
});
