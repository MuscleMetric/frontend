import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type { ErrorMap, OnboardingDraft } from "../types";

import { Stepper } from "../components/Stepper";
import { PrimaryCTA } from "../components/PrimaryCTA";

export function ConsistencyStep({
  draft,
  errors,
  onChange,
  onFinish,
  loading,
  stepLabel = "STEP 4 OF 4",
  rightLabel = "100%",
  progress = 1,
}: {
  draft: OnboardingDraft;
  errors: ErrorMap;
  onChange: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  onFinish: () => void;
  loading?: boolean;
  stepLabel?: string;
  rightLabel?: string;
  progress?: number;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const workoutChoices = [1, 2, 3, 4, 5, 6, 7];

  function setSteps(n: number) {
    onChange("stepsGoal", n);
  }

  const isPresetSteps = [8000, 10000, 12000].includes(draft.stepsGoal);

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Stepper label={stepLabel} progress={progress} rightLabel={rightLabel} />

        <View style={styles.header}>
          <Text style={styles.h1}>Define your consistency</Text>
          <Text style={styles.sub}>
            Set your weekly goals. We'll use these to calibrate training intensity and reminders.
          </Text>
        </View>

        {/* Workouts per week */}
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle}>Workouts per week</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>RECOMMENDED</Text>
          </View>
        </View>

        <View style={[styles.weekPill, errors.workoutsPerWeek && styles.errorBorder]}>
          {workoutChoices.map((n) => {
            const active = draft.workoutsPerWeek === n;
            return (
              <Pressable
                key={n}
                onPress={() => onChange("workoutsPerWeek", n)}
                style={[styles.weekItem, active && styles.weekItemActive]}
              >
                <Text style={[styles.weekText, active && styles.weekTextActive]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        {errors.workoutsPerWeek ? (
          <Text style={styles.error}>{errors.workoutsPerWeek}</Text>
        ) : null}

        <View style={{ height: 22 }} />

        {/* Daily steps */}
        <Text style={styles.rowTitle}>Daily Steps</Text>

        <View style={styles.stepsGrid}>
          <StepTile
            label="8k"
            sub="steps"
            active={draft.stepsGoal === 8000}
            onPress={() => setSteps(8000)}
          />
          <StepTile
            label="10k"
            sub="steps"
            active={draft.stepsGoal === 10000}
            onPress={() => setSteps(10000)}
          />
          <StepTile
            label="12k"
            sub="steps"
            active={draft.stepsGoal === 12000}
            onPress={() => setSteps(12000)}
          />
          <StepTile
            label="Custom"
            sub=""
            active={!isPresetSteps}
            onPress={() => setSteps(draft.stepsGoal)}
          />
        </View>

        {errors.stepsGoal ? <Text style={styles.error}>{errors.stepsGoal}</Text> : null}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Text style={{ color: colors.primary, fontWeight: "900" }}>i</Text>
          </View>
          <Text style={styles.infoText}>
            Used for reminders and weekly targets. You can adjust these anytime in settings.
          </Text>
        </View>
      </View>

      <PrimaryCTA
        title="Finish setup"
        onPress={onFinish}
        loading={loading}
        rightIcon={<Text style={styles.arrow}>→</Text>}
      />
    </View>
  );
}

function StepTile({
  label,
  sub,
  active,
  onPress,
}: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress} style={[styles.stepTile, active && styles.stepTileActive]}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text style={[styles.stepTileMain, active && styles.stepTileMainActive]}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.stepTileSub, active && styles.stepTileSubActive]}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    body: { flex: 1, paddingTop: 6, paddingHorizontal: 16 },

    header: {
      marginTop: 10,
      marginBottom: 22,
    },
    h1: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    sub: {
      color: colors.subtle,
      marginTop: 10,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      maxWidth: 360,
    },

    rowHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    rowTitle: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 16,
    },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(59,130,246,0.12)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(59,130,246,0.35)",
    },
    badgeText: {
      color: colors.primary,
      fontWeight: "900",
      fontSize: 11,
      letterSpacing: 0.8,
    },

    weekPill: {
      flexDirection: "row",
      borderRadius: 999,
      padding: 8,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      justifyContent: "space-between",
    },
    weekItem: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    weekItemActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    weekText: { color: colors.subtle, fontWeight: "900" },
    weekTextActive: { color: "#fff" },

    stepsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 12,
    },
    stepTile: {
      flexGrow: 1,
      flexBasis: "47%",
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: 18,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 70,
    },
    stepTileActive: {
      borderColor: colors.primary,
      backgroundColor: "rgba(0,0,0,0.10)",
    },
    stepTileMain: { color: colors.text, fontWeight: "900", fontSize: 18 },
    stepTileMainActive: { color: colors.text },
    stepTileSub: { color: colors.subtle, fontWeight: "800" },
    stepTileSubActive: { color: colors.subtle },

    infoCard: {
      marginTop: 16,
      borderRadius: 18,
      padding: 14,
      backgroundColor: "rgba(255,255,255,0.04)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    infoIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(59,130,246,0.12)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(59,130,246,0.25)",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    infoText: {
      flex: 1,
      color: colors.subtle,
      fontWeight: "700",
      lineHeight: 18,
    },

    error: {
      marginTop: 10,
      color: "#ef4444",
      fontSize: 12,
      fontWeight: "800",
    },
    errorBorder: {
      borderColor: "rgba(239,68,68,0.7)",
    },
    arrow: { color: "#fff", fontWeight: "900", fontSize: 16, marginTop: -1 },
  });
