// app/onboarding/stage3_five_workouts/components/TrendChartCard.tsx

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryScatter,
  VictoryTheme,
} from "victory-native";
import { useAppTheme } from "@/lib/useAppTheme";

export type TrendPoint = {
  x: number; // incoming (can be ignored)
  y: number;
  label?: string | null; // e.g. "Feb 10"
};

type Props = {
  title: string;
  valueText: string;
  unitText?: string;
  changePctText?: string | null;
  series: TrendPoint[];
};

type ChartPoint = {
  x: number; // 1..N (index-based)
  y: number;
  label: string; // date label
};

function normalizeSeries(input: TrendPoint[]): ChartPoint[] {
  if (!Array.isArray(input) || input.length === 0) return [];

  const cleaned = input
    .map((p) => ({
      x: Number(p?.x),
      y: Number(p?.y),
      label: (p?.label ?? "").trim(),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  cleaned.sort((a, b) => a.x - b.x);

  return cleaned.map((p, i) => ({
    x: i + 1,
    y: p.y,
    label: p.label.length ? p.label : `#${i + 1}`,
  }));
}

function takeLastNAndReindex(input: ChartPoint[], n: number): ChartPoint[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  const last = input.slice(Math.max(0, input.length - n));
  return last.map((p, i) => ({ ...p, x: i + 1 }));
}

function shortDateLabel(label: string) {
  const s = String(label ?? "").trim();
  // Keep it compact (helps avoid clipping)
  // Examples:
  // "Feb 10" -> "Feb 10"
  // "2026-02-11" -> "02-11"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(5);
  if (s.length > 8) return s.slice(0, 8);
  return s;
}

export function TrendChartCard({
  title,
  valueText,
  unitText,
  changePctText,
  series,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const [chartW, setChartW] = useState<number>(0);

  const data = useMemo(() => {
    const normalized = normalizeSeries(series);
    return takeLastNAndReindex(normalized, 4); // ✅ option B: last 4 points
  }, [series]);

  const ys = data.map((d) => d.y);
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;

  const pad = ys.length ? Math.max(1, (maxY - minY) * 0.18) : 1;
  const domainY: [number, number] = [Math.max(0, minY - pad), maxY + pad];

  // ✅ show all ticks for last-4 view
  const tickValues = useMemo(
    () => Array.from({ length: data.length }, (_, i) => i + 1),
    [data.length]
  );

  const labelByX = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of data) m.set(p.x, shortDateLabel(p.label));
    return m;
  }, [data]);

  const last = data.length ? data[data.length - 1] : null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.kicker}>{title}</Text>

        {!!changePctText ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{changePctText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{valueText}</Text>
        {!!unitText ? <Text style={styles.unit}>{unitText}</Text> : null}
      </View>

      <View
        style={styles.chartWrap}
        onLayout={(e) => setChartW(Math.floor(e.nativeEvent.layout.width))}
      >
        {data.length >= 2 && chartW > 0 ? (
          <VictoryChart
            width={chartW} // ✅ critical: Victory won't auto-stretch
            height={260}
            theme={VictoryTheme.material}
            padding={{ top: 18, left: 54, right: 46, bottom: 46 }} // ✅ keep last tick visible
            domain={{ y: domainY }}
            domainPadding={{ x: 18 }} // ✅ keep last point off the edge
          >
            <VictoryAxis
              tickValues={tickValues}
              tickFormat={(t) => labelByX.get(Number(t)) ?? ""}
              style={{
                axis: { stroke: "transparent" },
                grid: { stroke: "transparent" },
                ticks: { stroke: "transparent" },
                tickLabels: {
                  fill: colors.textMuted,
                  fontSize: 11,
                  fontFamily: typography.fontFamily.semibold,
                  padding: 10,
                },
              }}
            />

            <VictoryAxis
              dependentAxis
              tickCount={4}
              style={{
                axis: { stroke: "transparent" },
                ticks: { stroke: "transparent" },
                tickLabels: {
                  fill: colors.textMuted,
                  fontSize: 11,
                  fontFamily: typography.fontFamily.semibold,
                  padding: 6,
                },
                grid: {
                  stroke: colors.trackBorder,
                  strokeWidth: StyleSheet.hairlineWidth,
                },
              }}
            />

            <VictoryLine
              data={data}
              interpolation="monotoneX"
              style={{
                data: { stroke: colors.primary, strokeWidth: 3 },
              }}
            />

            {last ? (
              <VictoryScatter
                data={[last]}
                size={5.5}
                style={{
                  data: {
                    fill: colors.bg,
                    stroke: colors.primary,
                    strokeWidth: 3,
                  },
                }}
              />
            ) : null}
          </VictoryChart>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Not enough data yet</Text>
            <Text style={styles.emptySub}>
              Log a few more sessions for a real trend line.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      borderRadius: layout.radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: layout.space.lg,
      overflow: "hidden",
    },

    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: layout.space.md,
    },
    kicker: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },

    pill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.cardPressed,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },
    pillText: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      letterSpacing: 0.4,
    },

    valueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 10,
      marginTop: 10,
    },
    value: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 40,
      letterSpacing: -1.0,
    },
    unit: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 16,
      letterSpacing: 0.2,
    },

    chartWrap: {
      marginTop: 12,
      borderRadius: layout.radius.lg,
      overflow: "hidden",
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
      minHeight: 260,
      justifyContent: "center",
    },

    empty: { padding: layout.space.lg, alignItems: "center" },
    emptyTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.h3,
    },
    emptySub: {
      marginTop: 8,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      textAlign: "center",
      lineHeight: typography.lineHeight.sub,
    },
  });
