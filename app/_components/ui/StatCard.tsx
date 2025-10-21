// app/_components/statcard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../lib/useAppTheme";

type Props = {
  value: string | number;
  label: string;
  tint?: string;
};

export default function StatCard({ value, label, tint }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.card,
        tint ? { backgroundColor: tint } : { backgroundColor: colors.primaryBg },
      ]}
    >
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.text,
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2, // Android shadow
    },
    value: {
      fontSize: 28,
      fontWeight: "900",
      marginBottom: 2,
      color: colors.text,
    },
    label: {
      color: colors.subtle,
      fontWeight: "500",
      textAlign: "center",
    },
  });
