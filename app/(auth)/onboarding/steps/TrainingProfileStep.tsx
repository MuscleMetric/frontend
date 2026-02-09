import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type { Goal, Level, OnboardingDraft } from "../types";

import { Stepper } from "../components/Stepper";
import { PrimaryCTA } from "../components/PrimaryCTA";

export function TrainingProfileStep({
  draft,
  onChange,
  onNext,
  stepLabel = "STEP 3 OF 4",
  rightLabel = "75% Complete",
  progress = 0.75,
}: {
  draft: OnboardingDraft;
  onChange: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  onNext: () => void;
  stepLabel?: string;
  rightLabel?: string;
  progress?: number;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const levelOptions: { value: Level; title: string; desc: string }[] = [
    { value: "beginner", title: "Beginner", desc: "New to structured training." },
    { value: "intermediate", title: "Intermediate", desc: "Consistent training for 6+ months." },
    { value: "advanced", title: "Advanced", desc: "Experienced with complex movements." },
  ];

  const goalOptions: { value: Goal; label: string; icon: string }[] = [
    { value: "build_muscle", label: "Build Muscle", icon: "🏋️" },
    { value: "lose_fat", label: "Lose Fat", icon: "🔥" },
  ];

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Stepper label={stepLabel} progress={progress} rightLabel={rightLabel} />

        <View style={styles.header}>
          <Text style={styles.h1}>Training Profile</Text>
          <Text style={styles.sub}>
            Help us customize your workout intensity and volume.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>FITNESS LEVEL</Text>
        <View style={{ gap: 10 }}>
          {levelOptions.map((opt) => {
            const active = draft.level === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange("level", opt.value)}
                style={[styles.levelCard, active && styles.levelCardActive]}
              >
                <Text style={[styles.levelTitle, active && styles.levelTitleActive]}>
                  {opt.title}
                </Text>
                <Text style={[styles.levelDesc, active && styles.levelDescActive]}>
                  {opt.desc}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 18 }} />

        <Text style={styles.sectionLabel}>PRIMARY GOAL</Text>
        <View style={styles.goalGrid}>
          {goalOptions.map((g) => {
            const active = draft.primaryGoal === g.value;
            return (
              <Pressable
                key={g.value}
                onPress={() => onChange("primaryGoal", g.value)}
                style={[styles.goalTile, active && styles.goalTileActive]}
              >
                <Text style={styles.goalIcon}>{g.icon}</Text>
                <Text style={[styles.goalText, active && styles.goalTextActive]}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <PrimaryCTA title="Continue" onPress={onNext} />
    </View>
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

    sectionLabel: {
      color: colors.subtle,
      fontWeight: "900",
      letterSpacing: 1.1,
      fontSize: 12,
      marginBottom: 10,
    },

    levelCard: {
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
    },
    levelCardActive: {
      borderColor: colors.primary,
      backgroundColor: "rgba(0,0,0,0.12)",
    },
    levelTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
    levelTitleActive: { color: colors.text },
    levelDesc: { color: colors.subtle, marginTop: 4, fontWeight: "700" },
    levelDescActive: { color: colors.subtle },

    goalGrid: {
      flexDirection: "row",
      gap: 12,
    },
    goalTile: {
      flex: 1,
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      minHeight: 120,
    },
    goalTileActive: {
      borderColor: colors.primary,
      backgroundColor: "rgba(0,0,0,0.12)",
    },
    goalIcon: { fontSize: 22, marginBottom: 10, opacity: 0.95 },
    goalText: { color: colors.text, fontWeight: "900" },
    goalTextActive: { color: colors.text },
  });
