import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type { ErrorMap, OnboardingDraft } from "../types";

import { Stepper } from "../components/Stepper";
import { PrimaryCTA } from "../components/PrimaryCTA";

const PRESET_STEPS = [8000, 10000, 12000] as const;

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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
  onChange: <K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K]
  ) => void;
  onFinish: () => void;
  loading?: boolean;
  stepLabel?: string;
  rightLabel?: string;
  progress?: number;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const workoutChoices = [1, 2, 3, 4, 5, 6, 7];

  const stepsGoal = Number(draft.stepsGoal) || 0;
  const isPresetSteps = PRESET_STEPS.includes(stepsGoal as any);

  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState(String(stepsGoal || 10000));

  function setSteps(n: number) {
    onChange("stepsGoal", n);
  }

  function openCustom() {
    setCustomText(String(stepsGoal || 10000));
    setCustomOpen(true);
  }

  function saveCustom() {
    const raw = Number(String(customText).replace(/[^0-9]/g, ""));
    const safe = clampInt(Number.isFinite(raw) ? raw : 0, 1000, 50000);
    setSteps(safe);
    setCustomOpen(false);
  }

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Stepper label={stepLabel} progress={progress} rightLabel={rightLabel} />

        <View style={styles.header}>
          <Text style={styles.h1}>Define your consistency</Text>
          <Text style={styles.sub}>
            Set your weekly goals. We'll use these to calibrate training intensity
            and reminders.
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
                <Text style={[styles.weekText, active && styles.weekTextActive]}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {errors.workoutsPerWeek ? (
          <Text style={styles.error}>{errors.workoutsPerWeek}</Text>
        ) : null}

        <View style={{ height: 22 }} />

        {/* Daily steps */}
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle}>Daily Steps</Text>
          <Text style={styles.miniValue}>{stepsGoal.toLocaleString()}</Text>
        </View>

        <View style={styles.stepsGrid}>
          <StepTile
            label="8k"
            sub="steps"
            active={stepsGoal === 8000}
            onPress={() => setSteps(8000)}
          />
          <StepTile
            label="10k"
            sub="steps"
            active={stepsGoal === 10000}
            onPress={() => setSteps(10000)}
          />
          <StepTile
            label="12k"
            sub="steps"
            active={stepsGoal === 12000}
            onPress={() => setSteps(12000)}
          />
          <StepTile
            label={isPresetSteps ? "Custom" : `${Math.round(stepsGoal / 100) / 10}k`}
            sub={isPresetSteps ? "" : "custom"}
            active={!isPresetSteps}
            onPress={openCustom}
          />
        </View>

        {errors.stepsGoal ? <Text style={styles.error}>{errors.stepsGoal}</Text> : null}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Text style={{ color: colors.primary, fontWeight: "900" }}>i</Text>
          </View>
          <Text style={styles.infoText}>
            Used for reminders and weekly targets. You can adjust these anytime in
            settings.
          </Text>
        </View>
      </View>

      <PrimaryCTA
        title="Finish setup"
        onPress={onFinish}
        loading={loading}
        rightIcon={<Text style={styles.arrow}>→</Text>}
      />

      {/* Custom steps modal */}
      <Modal
        transparent
        animationType="fade"
        visible={customOpen}
        onRequestClose={() => setCustomOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCustomOpen(false)} />

        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", android: undefined })}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Custom daily steps</Text>
            <Text style={styles.modalSub}>Pick a target between 1,000 and 50,000.</Text>

            <TextInput
              value={customText}
              onChangeText={setCustomText}
              keyboardType="number-pad"
              placeholder="e.g. 9500"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              maxLength={6}
            />

            <View style={styles.quickRow}>
              {[6000, 8000, 10000, 12000, 15000].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setCustomText(String(n))}
                  style={styles.quickChip}
                >
                  <Text style={styles.quickChipText}>{(n / 1000).toFixed(0)}k</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setCustomOpen(false)} style={styles.modalBtnGhost}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>

              <Pressable onPress={saveCustom} style={styles.modalBtnPrimary}>
                <Text style={styles.modalBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    <Pressable
      onPress={onPress}
      style={[styles.stepTile, active && styles.stepTileActive]}
    >
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

    header: { marginTop: 10, marginBottom: 22 },
    h1: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    sub: {
      color: colors.textMuted,
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
    rowTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
    miniValue: { color: colors.textMuted, fontWeight: "900" },

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
    weekText: { color: colors.textMuted, fontWeight: "900" },
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
    stepTileSub: { color: colors.textMuted, fontWeight: "800" },
    stepTileSubActive: { color: colors.textMuted },

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
    infoText: { flex: 1, color: colors.textMuted, fontWeight: "700", lineHeight: 18 },

    error: { marginTop: 10, color: "#ef4444", fontSize: 12, fontWeight: "800" },
    errorBorder: { borderColor: "rgba(239,68,68,0.7)" },
    arrow: { color: "#fff", fontWeight: "900", fontSize: 16, marginTop: -1 },

    // modal
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    modalWrap: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    modalCard: {
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
    },
    modalTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
    modalSub: { color: colors.textMuted, marginTop: 6, fontWeight: "700" },
    modalInput: {
      marginTop: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      color: colors.text,
      fontWeight: "900",
      fontSize: 18,
      backgroundColor: "transparent",
    },
    quickRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    quickChip: {
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    quickChipText: { color: colors.text, fontWeight: "900" },

    modalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    modalBtnGhost: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    modalBtnGhostText: { color: colors.text, fontWeight: "900" },

    modalBtnPrimary: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    modalBtnPrimaryText: { color: "#fff", fontWeight: "900" },
  });
