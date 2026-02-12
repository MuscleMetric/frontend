import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { Stage3Payload, Stage3UiStrings } from "../types";
import PlanPreviewCard from "../components/PlanPreviewCard";

function roundNiceWeight(value: number, unit: string) {
  // kg -> nearest 2.5, lb -> nearest 5
  if (!Number.isFinite(value)) return value;
  const step = unit === "lb" ? 5 : 2.5;
  return Math.round(value / step) * step;
}

function pickTargetDelta(current: number, unit: string) {
  // realistic deltas; avoids +15kg on curls
  if (!Number.isFinite(current)) return unit === "lb" ? 25 : 10;

  if (unit === "lb") {
    if (current < 90) return 10;
    if (current < 220) return 25;
    return 35;
  }

  // kg
  if (current < 40) return 5;
  if (current < 100) return 10;
  return 15;
}

function fmtWeight(n: number, unit: string) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const txt = v % 1 === 0 ? String(v) : v.toFixed(1);
  return `${txt}${unit}`;
}

export default function PlanAdoption({
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

  useEffect(() => {
    console.log("[stage3] PlanAdoption payload:", payload);
  }, [payload]);

  const unit = (payload?.unit_weight ?? "kg").toLowerCase();

  const exName =
    payload?.spotlight_exercise_name ?? ui.spotlightTitle ?? "Your lift";
  const current = Number(
    payload?.spotlight_current_1rm ?? payload?.milestone_current_value ?? NaN
  );

  const delta = pickTargetDelta(current, unit);
  const target = roundNiceWeight(current + delta, unit);

  const progressPct =
    Number.isFinite(current) && Number.isFinite(target) && target > 0
      ? Math.max(0, Math.min(100, (current / target) * 100))
      : 0;

  const schedule = Array.isArray(payload?.recommended_schedule)
    ? payload!.recommended_schedule
    : [
        { dow: "Mon", kind: "session" },
        { dow: "Tue", kind: "rest" },
        { dow: "Wed", kind: "session" },
        { dow: "Thu", kind: "rest" },
        { dow: "Fri", kind: "session" },
      ];

  const footerRight =
    Number.isFinite(target) && Number.isFinite(current)
      ? `+${fmtWeight(target - current, unit)} to target`
      : "";

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>
        You've got <Text style={styles.h1Em}>momentum</Text> Now let’s focus it.
      </Text>

      <Text style={styles.sub}>
        The fastest way to keep improving is a structured plan — clear sessions,
        targets, and progress you can measure.
      </Text>

      <View style={{ marginTop: layout.space.md }}>
        <PlanPreviewCard
          title="Train with direction"
          statusText={payload?.milestone_on_track ? "ON TRACK" : "BUILDING"}
          days={schedule as any}
          milestoneTitle={String(exName)}
          targetLabel={fmtWeight(target, unit)}
          currentLabel={fmtWeight(current, unit)}
          progressPct={progressPct}
          footerLeft={`${Math.round(progressPct)}% Complete`}
          footerRight={footerRight}
        />
      </View>

      <Text style={styles.footer}>
        Create a plan and we’ll set targets automatically — you can edit
        anything later.
      </Text>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    wrap: { flex: 1, paddingTop: layout.space.md },

    h1Em: {
      color: colors.primary,
      fontFamily: typography.fontFamily.bold,
    },

    h1: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 44,
      lineHeight: 52,
      letterSpacing: -1.2,
    },

    sub: {
      marginTop: 12,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 520,
    },

    footer: {
      marginTop: layout.space.lg,
      textAlign: "center",
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      paddingHorizontal: layout.space.sm,
    },
  });
