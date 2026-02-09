import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type { ErrorMap, OnboardingDraft, UnitHeight, UnitWeight } from "../types";

import { Stepper } from "../components/Stepper";
import { UnitToggle } from "../components/UnitToggle";
import { PrimaryCTA } from "../components/PrimaryCTA";

export function BodyMetricsStep({
  draft,
  errors,
  onChange,
  onNext,
  stepLabel = "STEP 2 OF 4",
  progress = 0.5,
}: {
  draft: OnboardingDraft;
  errors: ErrorMap;
  onChange: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  onNext: () => void;
  stepLabel?: string;
  progress?: number;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heightText =
    draft.heightCm != null ? `${Math.round(draft.heightCm)} cm` : "—";
  const weightText =
    draft.weightKg != null ? `${draft.weightKg} kg` : "—";

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Stepper label={stepLabel} progress={progress} />

        <View style={styles.header}>
          <Text style={styles.h1}>Body Metrics</Text>
          <Text style={styles.sub}>
            Used to personalize training and estimates. You can edit later.
          </Text>
        </View>

        {/* HEIGHT */}
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>HEIGHT</Text>
          <UnitToggle<UnitHeight>
            value={draft.unitHeight}
            left={{ value: "cm", label: "CM" }}
            right={{ value: "ft", label: "FT" }}
            onChange={(v) => onChange("unitHeight", v)}
          />
        </View>

        <View style={[styles.rulerCard, !!errors.height && styles.cardError]}>
          <RulerPreview valueLabel={heightText} />
        </View>
        {errors.height ? <Text style={styles.error}>{errors.height}</Text> : null}

        <View style={{ height: 26 }} />

        {/* WEIGHT */}
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>WEIGHT</Text>
          <UnitToggle<UnitWeight>
            value={draft.unitWeight}
            left={{ value: "kg", label: "KG" }}
            right={{ value: "lb", label: "LB" }}
            onChange={(v) => onChange("unitWeight", v)}
          />
        </View>

        <View style={[styles.rulerCard, !!errors.weight && styles.cardError]}>
          <RulerPreview valueLabel={weightText} />
        </View>
        {errors.weight ? <Text style={styles.error}>{errors.weight}</Text> : null}
      </View>

      <PrimaryCTA
        title="Next Step"
        onPress={onNext}
        rightIcon={<Text style={styles.arrow}>→</Text>}
      />
    </View>
  );
}

function RulerPreview({ valueLabel }: { valueLabel: string }) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.rulerInner}>
      <View style={styles.centerLine} />

      <View style={styles.tickWrap}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.tick,
              i % 3 === 0 && styles.tickTall,
              i === 6 && { opacity: 0 }, // center line exists
            ]}
          />
        ))}
      </View>

      <View style={styles.rulerFooter}>
        <Text style={styles.rulerValue}>{valueLabel}</Text>
      </View>
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

    metricHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    metricLabel: {
      color: colors.subtle,
      fontWeight: "900",
      letterSpacing: 1.1,
      fontSize: 12,
    },

    rulerCard: {
      height: 130,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.04)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      overflow: "hidden",
    },
    cardError: {
      borderColor: "rgba(239,68,68,0.7)",
    },
    rulerInner: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    tickWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      opacity: 0.75,
    },
    tick: {
      width: 2,
      height: 14,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    tickTall: {
      height: 26,
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    centerLine: {
      position: "absolute",
      left: "50%",
      top: 16,
      bottom: 16,
      width: 3,
      borderRadius: 3,
      backgroundColor: colors.primary,
      transform: [{ translateX: -1.5 }],
    },
    rulerFooter: {
      position: "absolute",
      left: 18,
      right: 18,
      bottom: 12,
      alignItems: "center",
    },
    rulerValue: {
      color: colors.subtle,
      fontWeight: "800",
    },

    error: {
      marginTop: 10,
      color: "#ef4444",
      fontSize: 12,
      fontWeight: "800",
    },

    arrow: { color: "#fff", fontWeight: "900", fontSize: 16, marginTop: -1 },
  });
