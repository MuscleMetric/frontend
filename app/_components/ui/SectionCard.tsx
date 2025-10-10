import React from "react";
import { View, StyleSheet } from "react-native";

export default function SectionCard({
  children,
  tint,
}: {
  children: React.ReactNode;
  tint?: string;
}) {
  return (
    <View
      style={[
        styles.card,
        tint ? { backgroundColor: tint, borderColor: "transparent" } : null,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
});
