import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

export default function GoalsScreen() {
  const [tab] = useState<"plan">("plan");

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Plan Goals</Text>
          <Text style={styles.h2}>Goals derived from your active plan</Text>
        </View>
        {/* When we have plans, you might add a filter/switch here */}
      </View>

      <View style={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={{ color: "#6b7280" }}>
            No plan goals yet. Once you create a plan, its goals will appear here.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h1: { fontSize: 18, fontWeight: "800" },
  h2: { color: "#6b7280" },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
});
