// app/features/home/cards/VolumeTrendCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card, Pill } from "@/ui";

type SparkPoint = { label: string; value: number };

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function buildPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  const [p0, ...rest] = points;
  return `M ${p0.x} ${p0.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(" ");
}

export function VolumeTrendCard({
  card,
  summary,
}: {
  card: any;
  summary?: any;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const label = String(card?.label ?? "Volume");
  const value = Number(card?.value ?? 0);
  const unit = String(card?.unit ?? "kg");
  const delta = card?.delta_pct == null ? null : Number(card.delta_pct);

  const deltaLabel =
    delta == null ? "—" : delta >= 0 ? `+${delta}%` : `${delta}%`;

  // Trend card: avoid "danger" red (feels harsh). Use warning for drops.
  const pillTone = useMemo(() => {
    if (delta == null) return "neutral";
    if (delta >= 0) return "success";
    return "warning";
  }, [delta]);

  const spark: SparkPoint[] = Array.isArray(card?.sparkline)
    ? card.sparkline
    : [];

  const chart = useMemo(() => {
    const W = 164;
    const H = 64;
    const pad = 10;

    if (spark.length < 2) {
      return { W, H, d: "", last: null as null | { x: number; y: number } };
    }

    const vals = spark.map((p) => Number(p.value ?? 0));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(1e-6, max - min);

    const pts = spark.map((p, i) => {
      const x = pad + (i * (W - pad * 2)) / Math.max(1, spark.length - 1);
      const y = pad + (H - pad * 2) * (1 - (Number(p.value) - min) / span);
      return { x, y };
    });

    const d = buildPath(pts);
    const last = pts[pts.length - 1];

    return { W, H, d, last };
  }, [spark]);

  const topLabel = "Mon–Sun weeks · this week vs last week";

  // Stroke color: primary by default; if delta negative, shift to warning
  const stroke = delta != null && delta < 0 ? colors.warning : colors.primary;

  return (
    <Card style={styles.card}>
      <View style={{ gap: layout.space.sm }}>
        <View style={styles.row}>
          <Text style={styles.kicker}>{label.toUpperCase()}</Text>
          <Pill label={deltaLabel} tone={pillTone as any} />
        </View>

        <Text style={styles.meta}>{topLabel}</Text>

        <View style={styles.mainRow}>
          <Text style={styles.big} numberOfLines={1}>
            {fmt(value)}{" "}
            <Text style={styles.unit} numberOfLines={1}>
              {unit}
            </Text>
          </Text>

          {spark.length >= 2 ? (
            <View style={styles.sparkWrap}>
              <Svg width={chart.W} height={chart.H}>
                <Path
                  d={chart.d}
                  stroke={stroke}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {chart.last ? (
                  <Circle
                    cx={chart.last.x}
                    cy={chart.last.y}
                    r={3}
                    fill={stroke}
                  />
                ) : null}
              </Svg>

              <View style={styles.axisRow}>
                <Text style={styles.axisText} numberOfLines={1}>
                  {spark[0]?.label ?? ""}
                </Text>
                <Text style={styles.axisText} numberOfLines={1}>
                  {spark[spark.length - 1]?.label ?? ""}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      padding: layout.space.lg,
      borderRadius: layout.radius.xl,
    },

    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    kicker: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
      letterSpacing: 1.2,
      color: colors.textMuted,
    },

    meta: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },

    mainRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: layout.space.md,
    },

    big: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.hero,
      lineHeight: typography.lineHeight.hero,
      letterSpacing: -1.0,
      color: colors.text,
      flexShrink: 1,
    },

    unit: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      color: colors.textMuted,
    },

    sparkWrap: {
      width: 176,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,

      // ✅ Use new semantic track tokens
      backgroundColor: colors.trackBg,
      borderColor: colors.trackBorder,
    },

    axisRow: {
      marginTop: -2,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: layout.space.sm,
    },

    axisText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.textMuted,
      maxWidth: 72,
    },
  });
