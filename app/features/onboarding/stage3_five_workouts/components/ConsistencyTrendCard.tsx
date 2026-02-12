import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

type Props = {
  title: string; // e.g. "CONSISTENCY"
  highlight?: string | null; // e.g. "+2 over goal"
  body: string; // e.g. "You exceeded your weekly target."
  footnote?: string | null; // e.g. "Streak tracking starts after 2 full weeks."
};

export default function ConsistencyTrendCard({
  title,
  highlight,
  body,
  footnote,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.title}>{title}</Text>
        {!!highlight ? <Text style={styles.highlight}>{highlight}</Text> : null}
      </View>

      <Text style={styles.body}>{body}</Text>

      {!!footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      width: "100%",
      borderRadius: layout.radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: layout.space.lg,
    },

    headRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: layout.space.md,
    },

    title: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },

    highlight: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 0.4,
    },

    body: {
      marginTop: layout.space.md,
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.h3,
      lineHeight: typography.lineHeight.h3,
      letterSpacing: -0.2,
    },

    footnote: {
      marginTop: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },
  });
