// app/features/home/cards/VolumeTrendCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { BaseCard } from "../ui/BaseCard";
import { Pill } from "../ui/Pill";
import { homeTokens } from "../ui/homeTheme";

type SparkPoint = { label: string; value: number };

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function buildPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  const [p0, ...rest] = points;
  return `M ${p0.x} ${p0.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(" ");
}

export function VolumeTrendCard({ card }: { card: any }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  const label = String(card?.label ?? "Volume");
  const value = Number(card?.value ?? 0);
  const unit = String(card?.unit ?? "kg");
  const delta = card?.delta_pct == null ? null : Number(card.delta_pct);

  const deltaLabel = delta == null ? "—" : delta >= 0 ? `+${delta}%` : `${delta}%`;
  const tone = delta == null ? "neutral" : delta >= 0 ? "green" : "red";

  // expects: [{label:"15 Dec", value:123}, ...] (4 points)
  const spark: SparkPoint[] = Array.isArray(card?.sparkline) ? card.sparkline : [];

  const chart = useMemo(() => {
    const W = 164; // ✅ slightly wider
    const H = 64;
    const pad = 10;

    if (spark.length < 2) {
      return { W, H, pts: [] as { x: number; y: number }[], d: "", last: null as any };
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

    return { W, H, pts, d, last };
  }, [spark]);

  const topLabel = "Mon–Sun weeks · this week vs last week";

  return (
    <BaseCard>
      <View style={{ gap: 10 }}>
        <View style={styles.row}>
          <Text style={[styles.kicker, { color: t.subtle }]}>{label.toUpperCase()}</Text>
          <Pill label={deltaLabel} tone={tone as any} />
        </View>

        {/* ✅ Mon–Sun line ABOVE volume */}
        <Text style={[styles.meta, { color: t.subtle }]}>{topLabel}</Text>

        <View style={styles.mainRow}>
          <Text style={[styles.big, { color: t.text }]}>
            {fmt(value)}{" "}
            <Text style={[styles.unit, { color: t.subtle }]}>{unit}</Text>
          </Text>

          {/* Sparkline block */}
          {spark.length >= 2 ? (
            <View
              style={[
                styles.sparkWrap,
                {
                  // ✅ match the card background (not grey)
                  backgroundColor: t.cardBg,
                  borderColor: t.cardBorder,
                },
              ]}
            >
              <Svg width={chart.W} height={chart.H}>
                <Path d={chart.d} stroke={t.primary} strokeWidth={4} fill="none" />
                {chart.last ? (
                  <Circle cx={chart.last.x} cy={chart.last.y} r={6} fill={t.primary} />
                ) : null}
              </Svg>

              {/* x-axis labels (ends only) */}
              <View style={styles.axisRow}>
                <Text style={[styles.axisText, { color: t.subtle }]}>
                  {spark[0]?.label ?? ""}
                </Text>
                <Text style={[styles.axisText, { color: t.subtle }]}>
                  {spark[spark.length - 1]?.label ?? ""}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </BaseCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  meta: { fontSize: 14, fontWeight: "800" },

  mainRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  big: { fontSize: 36, fontWeight: "900", letterSpacing: -1.0 },
  unit: { fontSize: 18, fontWeight: "900" },

  sparkWrap: {
    width: 176, // ✅ slightly wider to match new W
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },

  axisRow: {
    marginTop: -2,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  axisText: { fontSize: 12, fontWeight: "800" },
});
