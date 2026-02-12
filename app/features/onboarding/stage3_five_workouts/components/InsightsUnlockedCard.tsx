import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";
import { InsightListItem } from "./InsightListItem";

export type InsightsUnlockedItem = {
  iconName: any;
  title: string;
  subtitle: string;
};

export function InsightsUnlockedCard({
  title = "Insights unlocked",
  items,
}: {
  title?: string;
  items: InsightsUnlockedItem[];
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.heroIcon}>
          <Icon name="sparkles-outline" size={20} color={colors.onPrimary} />
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <View style={styles.list}>
        {items.map((it, idx) => (
          <View key={`${it.title}-${idx}`} style={styles.itemRow}>
            <InsightListItem
              iconName={it.iconName}
              title={it.title}
              subtitle={it.subtitle}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      width: "100%",
      borderRadius: 28,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: layout.space.lg,
      overflow: "hidden",
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
      marginBottom: layout.space.lg,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      letterSpacing: -0.4,
    },

    list: {
      gap: layout.space.xl,
    },
    itemRow: {
      paddingTop: 4,
    },
  });
