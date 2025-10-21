// app/_components/planrow.tsx
import React, { useMemo } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../lib/useAppTheme";

type Props = {
  title: string;
  subtitle: string;
  status: string;
  statusColor: string;
  onPress?: () => void;
};

export default function PlanRow({ title, subtitle, status, statusColor, onPress }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtle}>{subtitle}</Text>
      </View>

      <View
        style={[
          styles.badge,
          {
            backgroundColor: `${statusColor}22`,
            borderColor: statusColor,
          },
        ]}
      >
        <Text style={[styles.badgeText, { color: statusColor }]}>{status}</Text>
      </View>

      <Text style={styles.chevron}>{">"}</Text>
    </Pressable>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    row: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      gap: 12,
    },
    title: { fontWeight: "800", marginBottom: 4, color: colors.text },
    subtle: { color: colors.subtle, fontSize: 13 },
    badge: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeText: { fontWeight: "700" },
    chevron: { fontSize: 18, color: colors.muted, marginLeft: 8 },
  });
