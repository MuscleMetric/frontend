import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

export function AutofillNextSessionCard({
  workoutTitle,
  weightLabel,
  targetsLabel,
  statusRight = "Coming soon",
  badgeText = "AUTO-FILL ACTIVE",
  footnote = "Auto-filled from last session",
}: {
  workoutTitle: string;
  weightLabel: string; // "60 kg"
  targetsLabel: string; // "3×8"
  statusRight?: string;
  badgeText?: string;
  footnote?: string;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{workoutTitle}</Text>
          <Text style={styles.right}>{statusRight}</Text>
        </View>

        <View style={styles.pillsRow}>
          <MetricPill label="WEIGHT" value={weightLabel} />
          <MetricPill label="TARGETS" value={targetsLabel} />
        </View>

        <View style={styles.foot}>
          <Icon
            name="information-circle-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.footText}>{footnote}</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Icon name="sparkles" size={14} color={colors.primary} />
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      </View>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    wrap: {
      position: "relative",
      marginTop: 10,
    },

    badgeRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 8,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.cardPressed,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(37,99,235,0.25)",
    },
    badgeText: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 1.2,
    },

    card: {
      borderRadius: layout.radius.xl,
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(37,99,235,0.35)",
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
      gap: 12,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 18,
      letterSpacing: -0.3,
    },
    right: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 14,
    },

    pillsRow: {
      flexDirection: "row",
      gap: 12,
    },
    pill: {
      flex: 1,
      borderRadius: layout.radius.xl,
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: "rgba(0,0,0,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 80,
    },
    pillLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 1.2,
    },
    pillValue: {
      marginTop: 8,
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
      fontSize: 24,
      letterSpacing: -0.5,
    },

    foot: {
      marginTop: 14,
      borderRadius: layout.radius.lg,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.cardPressed,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    footText: {
      flex: 1,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 13,
      lineHeight: 18,
    },
  });
