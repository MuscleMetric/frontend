import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";

export function CardShell({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return <View style={styles.card}>{children}</View>;
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: "rgba(255,255,255,0.04)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
    },
  });
