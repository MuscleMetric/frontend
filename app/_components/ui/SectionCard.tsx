// app/_components/sectioncard.tsx
import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../../../lib/useAppTheme";

type Props = {
  children: React.ReactNode;
  tint?: string;
};

export default function SectionCard({ children, tint }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2, // Android shadow
    },
  });
