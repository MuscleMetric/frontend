// app/_components/settingrow.tsx
import React, { useMemo } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useAppTheme } from "../../../lib/useAppTheme";

type Props = {
  icon: string;
  title: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
};

export default function SettingRow({ icon, title, right, onPress, chevron }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {right}
      {chevron && <Text style={styles.chevron}>{">"}</Text>}
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
      gap: 12,
    },
    icon: {
      fontSize: 18,
      width: 24,
      textAlign: "center",
      color: colors.primaryText,
    },
    title: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      fontWeight: "500",
    },
    chevron: {
      fontSize: 18,
      color: colors.muted,
      marginLeft: 8,
    },
  });
