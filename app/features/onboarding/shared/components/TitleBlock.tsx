import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";

export function TitleBlock({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { colors, typography } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    wrap: { marginTop: 8, marginBottom: 18 },
    title: {
      color: colors.text,
      fontSize: 34,
      fontFamily: typography?.fontFamily?.bold,
      letterSpacing: -0.8,
    },
    sub: {
      marginTop: 10,
      color: colors.textMuted ?? colors.subtle,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: typography?.fontFamily?.medium,
      maxWidth: 360,
    },
  });
