import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

import { AutofillNextSessionCard } from "./components/AutofillNextSessionCard";
import { PrimaryCTA } from "../shared/components/PrimaryCTA";

type TrackedSet = {
  set_number: number;
  weight: number | null;
  reps: number | null;
};

type TrackedExercise = {
  exercise_id: string;
  exercise_name: string;
  order_index?: number | null;
  sets: TrackedSet[];
};

type RememberSetsProps = {
  unitWeight?: "kg" | "lb" | string;
  trackedSets?: TrackedExercise[] | null;
  workoutTitle?: string;
  nextWorkoutTitle?: string;
  nextWeightLabel?: string;
  nextTargetsLabel?: string;
  onPrimary: () => void;
};

function fmtWeight(n: number | null, unit: string) {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const txt = v % 1 === 0 ? String(v) : v.toFixed(1);
  return `${txt} ${unit}`;
}

export default function RememberSets(props: RememberSetsProps) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(false);

  const unit = props.unitWeight ?? "kg";
  const tracked = props.trackedSets ?? [];

  const primary = tracked[0];
  const primarySets = primary?.sets ?? [];

  const avgWeight =
    primarySets.length > 0
      ? (
          primarySets.map((s) => s.weight).filter((w) => w != null) as number[]
        ).reduce((a, b) => a + b, 0) / primarySets.length
      : null;

  const targetReps =
    primarySets.length > 0
      ? Math.round(
          (
            primarySets.map((s) => s.reps).filter((r) => r != null) as number[]
          ).reduce((a, b) => a + b, 0) / primarySets.length
        )
      : null;

  const defaultNextWorkoutTitle =
    primary?.exercise_name ?? props.workoutTitle ?? "Next session";

  const defaultNextTargets = primarySets.length
    ? `${primarySets.length}×${targetReps ?? "—"}`
    : "—";

  const defaultNextWeight = fmtWeight(avgWeight, unit);

  async function onPrimary() {
    if (loading) return;
    setLoading(true);
    try {
      props.onPrimary();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Text style={styles.brand}>MUSCLEMETRIC</Text>

        <Text style={styles.h1}>We&apos;ll remember your sets</Text>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: layout.space.lg }}
          showsVerticalScrollIndicator={false}
        >
          {/* NEXT SESSION */}
          <Text style={styles.sectionLabel}>NEXT SESSION</Text>

          <AutofillNextSessionCard
            workoutTitle={props.nextWorkoutTitle ?? defaultNextWorkoutTitle}
            statusRight="Coming soon"
            weightLabel={props.nextWeightLabel ?? defaultNextWeight}
            targetsLabel={props.nextTargetsLabel ?? defaultNextTargets}
            badgeText="AUTO-FILL ACTIVE"
            footnote="Auto-filled from last session"
          />

          <Text style={styles.footerHint}>
            Edit anytime. But you&apos;ll{" "}
            <Text style={styles.bold}>never start from zero</Text> again.
          </Text>

          {/* ARROW */}
          <View style={styles.arrowWrap}>
            <View style={styles.arrowBtn}>
              <Icon name="arrow-down" size={20} color={colors.onPrimary} />
            </View>
          </View>

          {/* TODAY SECTION */}
          <Text style={styles.sectionLabel}>FIRST SESSION</Text>

          {tracked.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No sets found</Text>
              <Text style={styles.cardSub}>
                We couldn&apos;t load set data for your last session.
              </Text>
            </View>
          ) : (
            tracked.map((ex) => (
              <View key={ex.exercise_id} style={styles.card}>
                <Text style={styles.exerciseTitle}>{ex.exercise_name}</Text>

                <View style={styles.setGrid}>
                  {ex.sets.map((s) => (
                    <View
                      key={`${ex.exercise_id}-${s.set_number}`}
                      style={styles.setPill}
                    >
                      <Text style={styles.setLabel}>SET {s.set_number}</Text>
                      <Text style={styles.setValue}>
                        {fmtWeight(s.weight, unit)}{" "}
                        <Text style={styles.muted}>×</Text> {s.reps ?? "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.bottom}>
        <PrimaryCTA title="Continue" onPress={onPrimary} loading={loading} />
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.bg,
    },

    body: {
      flex: 1,
      paddingTop: layout.space.lg,
      paddingHorizontal: layout.space.lg,
    },

    bottom: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.md,
      paddingBottom: layout.space.lg,
      backgroundColor: colors.bg,
    },

    brand: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 2,
      fontSize: typography.size.meta,
      textAlign: "center",
      marginBottom: layout.space.sm,
    },

    h1: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.hero,
      lineHeight: typography.lineHeight.hero,
      letterSpacing: -1,
      marginBottom: layout.space.lg,
    },

    sectionLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 1.2,
      marginBottom: layout.space.sm,
    },

    card: {
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: layout.space.sm,
    },

    cardTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
    },

    cardSub: {
      marginTop: layout.space.xs,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
    },

    exerciseTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      marginBottom: layout.space.sm,
    },

    setGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: layout.space.sm,
    },

    setPill: {
      borderRadius: layout.radius.pill,
      paddingVertical: layout.space.sm,
      paddingHorizontal: layout.space.md,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },

    setLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      marginBottom: 4,
      textTransform: "uppercase",
    },

    setValue: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
    },

    muted: {
      color: colors.textMuted,
    },

    arrowWrap: {
      alignItems: "center",
      marginVertical: layout.space.lg,
    },

    arrowBtn: {
      width: 52,
      height: 52,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    footerHint: {
      marginTop: layout.space.lg,
      textAlign: "center",
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },

    bold: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
    },
  });
