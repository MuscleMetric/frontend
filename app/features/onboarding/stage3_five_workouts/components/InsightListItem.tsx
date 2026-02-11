import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

export function InsightListItem({
  iconName,
  title,
  subtitle,
}: {
  iconName: any;
  title: string;
  subtitle: string;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Icon name={iconName} size={18} color={colors.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.h3,
      lineHeight: typography.lineHeight.h3,
      letterSpacing: -0.2,
    },
    sub: {
      marginTop: 2,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },
  });
