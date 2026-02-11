import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon, type IconName } from "@/ui/icons/Icon";

export function InsightRow({
  indexLabel,          // "INSIGHT 01"
  title,               // "Progress over time"
  subtitle,            // "Visual volume tracking"
  iconName,            // Ionicons name
  locked = true,
}: {
  indexLabel: string;
  title: string;
  subtitle: string;
  iconName: IconName;
  locked?: boolean;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <View style={styles.topLine}>
          {locked ? (
            <Icon name="lock-closed" size={12} color={colors.textMuted} />
          ) : (
            <Icon name="checkmark-circle" size={12} color={colors.success} />
          )}
          <Text style={styles.index}>{indexLabel}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>

      <View style={styles.iconBox}>
        <Icon name={iconName} size={22} color={colors.textMuted} />
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: layout.radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    topLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
      opacity: 0.85,
    },
    index: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 11,
      letterSpacing: 1.3,
    },
    title: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 16,
      letterSpacing: -0.2,
    },
    sub: {
      marginTop: 4,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 13,
    },
    iconBox: {
      width: 64,
      height: 54,
      borderRadius: layout.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
