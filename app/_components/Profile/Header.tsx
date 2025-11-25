// app/_components/header.tsx
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "../../../lib/useAppTheme";

type Props = {
  name: string;
  email: string;
  joined: string;
  onEdit?: () => void;
};

export default function Header({ name, email, joined, onEdit }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

        {onEdit && (
          <Pressable style={styles.editBtn} onPress={onEdit}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
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
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    avatarText: { color: colors.onPrimary, fontSize: 22, fontWeight: "800" },
    title: { fontSize: 18, fontWeight: "800", marginBottom: 4, color: colors.text },
    subtle: { color: colors.subtle },
    editBtn: {
      backgroundColor: colors.primaryBg,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    editText: { fontWeight: "700", color: colors.primaryText },
  });
