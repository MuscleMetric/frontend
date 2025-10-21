// app/_components/achievementscard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../lib/useAppTheme";

type Props = {
  title: string;
  description: string;
  unlocked?: boolean;
};

export default function AchievementCard({ title, description, unlocked }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.card,
        unlocked ? styles.unlockedCard : styles.lockedCard,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !unlocked }}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
    </View>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    unlockedCard: {
      backgroundColor: colors.successBg,
      borderColor: colors.successText,
    },
    lockedCard: {
      opacity: 0.75,
    },
    title: { fontWeight: "700", fontSize: 16, color: colors.text },
    desc: { color: colors.subtle, marginTop: 4 },
  });
