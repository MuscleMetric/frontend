import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, PanResponder, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type {
  ErrorMap,
  OnboardingDraft,
  UnitHeight,
  UnitWeight,
} from "../types";

import { Stepper } from "../components/Stepper";
import { UnitToggle } from "../components/UnitToggle";
import { PrimaryCTA } from "../components/PrimaryCTA";

const CM_PER_IN = 2.54;
const LB_PER_KG = 2.2046226218;

function cmToFtIn(cm: number) {
  const totalIn = cm / CM_PER_IN;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return { ft, inch };
}
function kgToLb(kg: number) {
  return Math.round(kg * LB_PER_KG);
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function roundToStep(v: number, step: number) {
  const inv = 1 / step;
  return Math.round(v * inv) / inv;
}

function cmToIn(cm: number) {
  return cm / CM_PER_IN;
}
function inToCm(inches: number) {
  return inches * CM_PER_IN;
}
function kgToLbExact(kg: number) {
  return kg * LB_PER_KG;
}
function lbToKgExact(lb: number) {
  return lb / LB_PER_KG;
}

function formatInchesAsFtIn(totalInches: number) {
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches - ft * 12);
  return `${ft}'${inch}"`;
}

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
  onChange: <K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K]
  ) => void;
  onNext: () => void;
  stepLabel?: string;
  progress?: number;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heightCm = draft.heightCm ?? 175;
  const weightKg = draft.weightKg ?? 70;

  const heightText =
    draft.unitHeight === "cm"
      ? `${Math.round(heightCm)} cm`
      : (() => {
          const { ft, inch } = cmToFtIn(heightCm);
          return `${ft} ft ${inch} in`;
        })();

  const weightText =
    draft.unitWeight === "kg" ? `${weightKg} kg` : `${kgToLb(weightKg)} lb`;

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

        {draft.unitHeight === "cm" ? (
          <RulerControl
            value={heightCm} // cm
            min={100}
            max={250}
            step={1}
            valueLabel={heightText}
            error={!!errors.height}
            onChange={(v) => onChange("heightCm", v)}
            formatMajorLabel={(v) => `${Math.round(v)}`} // cm labels
          />
        ) : (
          <RulerControl
            // We operate ruler in inches, but store in cm
            value={cmToIn(heightCm)} // inches
            min={36} // 3'0"
            max={98} // 8'2"
            step={1} // 1 inch steps
            valueLabel={heightText}
            error={!!errors.height}
            onChange={(inches) => onChange("heightCm", inToCm(inches))}
            formatMajorLabel={(inches) => formatInchesAsFtIn(inches)}
          />
        )}

        {errors.height ? (
          <Text style={styles.error}>{errors.height}</Text>
        ) : null}

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

        {draft.unitWeight === "kg" ? (
          <RulerControl
            value={weightKg} // kg
            min={30}
            max={300}
            step={0.5}
            valueLabel={weightText}
            error={!!errors.weight}
            onChange={(v) => onChange("weightKg", v)}
            formatMajorLabel={(v) => `${Math.round(v)}`} // kg labels
          />
        ) : (
          <RulerControl
            // Ruler in pounds, store in kg
            value={kgToLbExact(weightKg)} // lb (not rounded so it tracks smoothly)
            min={66}
            max={660}
            step={1}
            valueLabel={weightText}
            error={!!errors.weight}
            onChange={(lb) => onChange("weightKg", lbToKgExact(lb))}
            formatMajorLabel={(lb) => `${Math.round(lb)}`} // lb labels
          />
        )}

        {errors.weight ? (
          <Text style={styles.error}>{errors.weight}</Text>
        ) : null}
      </View>

      <PrimaryCTA
        title="Next Step"
        onPress={onNext}
        rightIcon={<Text style={styles.arrow}>→</Text>}
      />
    </View>
  );
}

/**
 * Drag-to-adjust ruler.
 * - Drag right => increases value
 * - Drag left => decreases value
 * - Snaps to `step`
 */
function RulerControl({
  value,
  min,
  max,
  step,
  valueLabel,
  error,
  onChange,
  formatMajorLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  valueLabel: string;
  error?: boolean;
  onChange: (v: number) => void;
  formatMajorLabel?: (v: number) => string;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const PX_PER_STEP = 10;
  const WINDOW_STEPS = 80;

  const [width, setWidth] = useState(0);
  const centerX = width / 2;

  const tx = useRef(new Animated.Value(0)).current;

  const startVal = useRef(value);
  const startX = useRef(0);
  const dragging = useRef(false);

  // haptics: only fire when step index changes
  const lastHapticIndex = useRef<number | null>(null);

  const valueWindow = useMemo(() => {
    const totalSteps = Math.round((max - min) / step);
    const stepsFromMin = Math.round((value - min) / step);

    const startSteps = clamp(stepsFromMin - WINDOW_STEPS, 0, totalSteps);
    const endSteps = clamp(stepsFromMin + WINDOW_STEPS, 0, totalSteps);

    const start = min + startSteps * step;
    const end = min + endSteps * step;

    return { start, end, startSteps, endSteps, totalSteps };
  }, [value, min, max, step]);

  const ticks = useMemo(() => {
    const arr: { v: number; i: number; globalStep: number }[] = [];
    const count = valueWindow.endSteps - valueWindow.startSteps;

    for (let i = 0; i <= count; i++) {
      const globalStep = valueWindow.startSteps + i;
      arr.push({ v: valueWindow.start + i * step, i, globalStep });
    }
    return arr;
  }, [valueWindow, step]);

  // keep track aligned when not dragging
  const currentIndex = (value - valueWindow.start) / step;
  const targetTx = centerX - currentIndex * PX_PER_STEP;
  if (!dragging.current && width > 0) {
    tx.setValue(targetTx);
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
        onPanResponderGrant: (_, g) => {
          dragging.current = true;
          startVal.current = value;
          startX.current = g.x0;
          lastHapticIndex.current = Math.round((value - min) / step);
        },
        onPanResponderMove: (_, g) => {
          if (!width) return;

          const dx = g.moveX - startX.current;
          const stepsMoved = Math.round(dx / PX_PER_STEP);

          const next = clamp(
            roundToStep(startVal.current + stepsMoved * step, step),
            min,
            max
          );

          if (next !== value) onChange(next);

          // slide track
          const idx = (next - valueWindow.start) / step;
          tx.setValue(centerX - idx * PX_PER_STEP);

          // haptic tick when we cross a step boundary
          const idxGlobal = Math.round((next - min) / step);
          if (lastHapticIndex.current !== idxGlobal) {
            lastHapticIndex.current = idxGlobal;
            // light “tick”
            Haptics.selectionAsync().catch(() => {});
          }
        },
        onPanResponderRelease: () => {
          dragging.current = false;
          if (!width) return;

          const snapped = clamp(roundToStep(value, step), min, max);
          const idx = (snapped - valueWindow.start) / step;
          const snappedTx = centerX - idx * PX_PER_STEP;

          Animated.spring(tx, {
            toValue: snappedTx,
            useNativeDriver: true,
            damping: 18,
            stiffness: 220,
            mass: 0.7,
          }).start();
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
        },
      }),
    [value, width, centerX, step, min, max, onChange, valueWindow, tx]
  );

  // Colors that work in light + dark (don’t use faint white)
  const minorTickColor = colors.trackBorder ?? "rgba(0,0,0,0.12)";
  const majorTickColor = colors.textMuted ?? "rgba(0,0,0,0.35)";

  return (
    <View
      style={[styles.rulerCard, error && styles.cardError]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
    >
      {/* Track viewport (ticks slide under this) */}
      <View style={styles.trackViewport}>
        <Animated.View
          style={[
            styles.tickTrack,
            {
              transform: [{ translateX: tx }],
            },
          ]}
        >
          {ticks.map(({ v, i, globalStep }) => {
            const isMajor = globalStep % 10 === 0;
            const isMedium = !isMajor && globalStep % 5 === 0;

            return (
              <View
                key={`${globalStep}`}
                style={[
                  styles.tick,
                  { left: i * PX_PER_STEP, backgroundColor: minorTickColor },
                  isMedium && styles.tickMedium,
                  isMajor && styles.tickMajor,
                  isMajor && { backgroundColor: majorTickColor },
                ]}
              >
                {isMajor ? (
                  <Text style={styles.tickLabel}>
                    {formatMajorLabel
                      ? formatMajorLabel(v)
                      : String(Math.round(v))}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Animated.View>

        {/* Edge fades */}
        <LinearGradient
          pointerEvents="none"
          colors={[colors.background, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fadeLeft}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fadeRight}
        />

        {/* Fixed center line */}
        <View style={styles.centerLine} />
      </View>

      {/* Value label */}
      <View style={styles.rulerFooter}>
        <Text style={styles.rulerValue}>{valueLabel}</Text>
        <Text style={styles.rulerHint}>Drag to adjust</Text>
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
    rulerHint: {
      marginTop: 4,
      color: "rgba(255,255,255,0.35)",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.3,
    },

    trackViewport: {
      height: 78,
      marginTop: 14,
      borderRadius: 18,
      overflow: "hidden",
      justifyContent: "center",
    },

    tickTrack: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 10,
      height: 52,
    },

    tick: {
      position: "absolute",
      bottom: 0,
      width: 2,
      height: 12,
      borderRadius: 2,
    },

    tickMedium: {
      height: 22,
    },

    tickMajor: {
      height: 36,
    },

    tickLabel: {
      position: "absolute",
      top: -18,
      left: -14,
      width: 32,
      textAlign: "center",
      fontSize: 10,
      fontWeight: "900",
      color: "rgba(127,127,127,0.6)",
    },

    fadeLeft: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 40,
    },

    fadeRight: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 40,
    },

    error: {
      marginTop: 10,
      color: "#ef4444",
      fontSize: 12,
      fontWeight: "800",
    },

    arrow: { color: "#fff", fontWeight: "900", fontSize: 16, marginTop: -1 },
  });
