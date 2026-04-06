import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Lock, ChevronRight } from "lucide-react-native";

type Props = {
  onPress: () => void;
};

export default function LockedExerciseSummaryCard({ onPress }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Lock size={18} color="#B4C5FF" />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Exercise Summary</Text>
          <Text style={styles.subtitle}>
            Pro unlocks deeper analytics, trends, and insights for your exercises.
          </Text>
        </View>
      </View>

      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>See Pro Features</Text>
        <ChevronRight size={18} color="#081120" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#121B2E",
    borderRadius: 22,
    padding: 18,
  },
  header: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(180, 197, 255, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: "#F2F5FF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: "#B7C0D9",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#5C8DFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#081120",
    fontSize: 16,
    fontWeight: "900",
  },
});