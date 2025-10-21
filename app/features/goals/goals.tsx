import { router } from "expo-router";
import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GoalsScreen() {
  const [tab] = useState<"plan">("plan");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.headerRow}>
        <View>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>← Back</Text>
          </Pressable>
          <Text style={styles.h1}>Plan Goals</Text>
          <Text style={styles.h2}>Goals derived from your active plan</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={{ color: "#6b7280" }}>
            No plan goals yet. Once you create a plan, its goals will appear
            here.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  link: { color: "#2563eb", fontWeight: "700", width: 52 },
  headerRow: {
    paddingBottom: 8,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  body: { flex: 1, paddingVertical: 16 },
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
