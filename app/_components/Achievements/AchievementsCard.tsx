import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AchievementCard({
  title,
  description,
  unlocked,
}: {
  title: string;
  description: string;
  unlocked?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        unlocked ? styles.unlocked : styles.locked,
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  unlocked: { backgroundColor: "#e6f7ea", borderColor: "#22c55e" },
  locked: { opacity: 0.6 },
  title: { fontWeight: "700", fontSize: 16 },
  desc: { color: "#6b7280", marginTop: 4 },
});
