import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

export default function Header({
  name,
  email,
  joined,
  onEdit,
}: {
  name: string;
  email: string;
  joined: string;
  onEdit?: () => void;
}) {
  const firstLetter = name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <View style={styles.container}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstLetter}</Text>
          </View>
          <View>
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.subtle}>{email}</Text>
            <Text style={styles.subtle}>Joined {joined}</Text>
          </View>
        </View>

        <Pressable style={styles.editBtn} onPress={onEdit}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "white", borderRadius: 16, padding: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0b1e4b", // navy blue
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "white", fontSize: 22, fontWeight: "800" },
  title: { fontSize: 18, fontWeight: "800", marginBottom: "2%" },
  subtle: { color: "#6b7280" },
  editBtn: {
    backgroundColor: "#e6f0ff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  editText: { fontWeight: "700", color: "#0b6aa9" },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
});
