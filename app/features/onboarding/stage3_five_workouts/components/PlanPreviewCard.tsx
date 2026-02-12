import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

type ScheduleItem = {
  dow: string; // "Mon"
  kind: "session" | "rest";
};

type Props = {
  title: string; // "Train with direction"
  statusText?: string; // "ON TRACK"
  days: ScheduleItem[]; // 5 items
  milestoneTitle: string; // "Back Squat"
  targetLabel: string; // "140kg"
  currentLabel: string; // "105kg"
  progressPct: number; // 0..100
  footerLeft?: string; // "75% Complete"
  footerRight?: string; // "+35kg to target"
};

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function PlanPreviewCard({
  title,
  statusText = "ON TRACK",
  days,
  milestoneTitle,
  targetLabel,
  currentLabel,
  progressPct,
  footerLeft,
  footerRight,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const pct = clampPct(progressPct);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.kicker}>CURRENT PROGRAM</Text>

        <View style={styles.statusPill}>
          <View style={styles.dot} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>

      <View style={styles.daysRow}>
        {days.map((d, idx) => {
          const isSession = d.kind === "session";
          return (
            <View key={`${d.dow}-${idx}`} style={styles.dayItem}>
              <View style={[styles.dayCircle, isSession ? styles.dayCircleOn : styles.dayCircleOff]}>
                <Text style={[styles.dayLetter, isSession ? styles.dayLetterOn : styles.dayLetterOff]}>
                  {d.dow[0]}
                </Text>
              </View>
              <Text style={styles.daySub}>{isSession ? "Session" : "Rest"}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>TARGET MILESTONE</Text>

      <View style={styles.milestoneRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.milestoneName}>{milestoneTitle}</Text>
          <Text style={styles.targetText}>{targetLabel}</Text>
        </View>

        <View style={styles.currentCol}>
          <Text style={styles.currentLabel}>CURRENT</Text>
          <Text style={styles.currentValue}>{currentLabel}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerMuted}>{footerLeft ?? `${pct}% Complete`}</Text>
        <Text style={styles.footerMuted}>{footerRight ?? ""}</Text>
      </View>
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

    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: layout.space.md,
    },

    kicker: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },

    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: layout.space.md,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    statusText: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },

    title: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      lineHeight: typography.lineHeight.h2,
      letterSpacing: -0.3,
      marginBottom: layout.space.md,
    },

    daysRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: layout.space.lg,
    },
    dayItem: { alignItems: "center", width: 56 },
    dayCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
    dayCircleOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayCircleOff: {
      backgroundColor: colors.trackBg,
      borderColor: colors.trackBorder,
    },
    dayLetter: {
      fontFamily: typography.fontFamily.bold,
      fontSize: 16,
      letterSpacing: 0.2,
    },
    dayLetterOn: { color: colors.onPrimary },
    dayLetterOff: { color: colors.textMuted },
    daySub: {
      marginTop: 6,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 12,
    },

    sectionLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: layout.space.sm,
    },

    milestoneRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: layout.space.md,
      marginBottom: layout.space.md,
    },
    milestoneName: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 28,
      letterSpacing: -0.6,
    },
    targetText: {
      marginTop: 6,
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
      fontSize: 24,
      letterSpacing: -0.4,
    },

    currentCol: { alignItems: "flex-end" },
    currentLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 1.0,
    },
    currentValue: {
      marginTop: 6,
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 20,
      letterSpacing: -0.3,
    },

    track: {
      height: 12,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: layout.radius.pill,
    },

    footerRow: {
      marginTop: layout.space.md,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footerMuted: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 12,
    },
  });
