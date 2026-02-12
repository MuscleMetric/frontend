// app/onboarding/stage3_five_workouts/screens/ProgressTrends.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { Stage3Payload, Stage3UiStrings } from "../types";
import { TrendChartCard, type TrendPoint } from "../components/TrendChartCard";

function fmtPct(p: number | null | undefined) {
  if (p == null || !Number.isFinite(Number(p))) return null;
  const n = Number(p);
  const sign = n >= 0 ? "+" : "";
  // keep it clean, avoid insane decimals
  const val = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${sign}${val}%`;
}

function fmtWeight(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

export default function ProgressTrends({
  ui,
  payload,
}: {
  ui: Stage3UiStrings;
  payload?: Stage3Payload | null;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const exName =
    payload?.spotlight_exercise_name ?? ui.spotlightTitle ?? "Your lift";
  const unit = (payload?.unit_weight ?? "kg").toLowerCase();

  const valueText = fmtWeight(payload?.spotlight_current_1rm ?? null);
  const changeText = fmtPct(payload?.spotlight_change_pct ?? null);

  const title = `${String(exName).toUpperCase()} 1RM`;

  const series = (payload?.spotlight_series ?? []) as TrendPoint[];

  return (
    <View style={styles.wrap}>
        <Text style={styles.h1}>
          See you’re <Text style={styles.h1Em}>actually</Text> getting
          stronger.
        </Text>

        <Text style={styles.sub}>
          We analyzed your first {ui.workoutsTotalLabel} workouts to calculate
          real strength trends.
        </Text>

        <View style={{ marginTop: layout.space.lg }}>
          <TrendChartCard
            title={title}
            valueText={valueText}
            unitText={unit}
            changePctText={changeText}
            series={series}
          />
        </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      paddingTop: layout.space.md,
    },

    h1: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 44,
      lineHeight: 52,
      letterSpacing: -1.2,
    },
    h1Em: {
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
    },

    sub: {
      marginTop: 12,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 520,
    },
  });
