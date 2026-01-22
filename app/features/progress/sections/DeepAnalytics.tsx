import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import {
  Screen,
  ScreenHeader,
  Card,
  LoadingScreen,
  ErrorState,
  Icon,
} from "@/ui";
import Svg, {
  Circle,
  Line,
  Rect,
  Path,
  Text as SvgText,
} from "react-native-svg";

type DeepAnalyticsPayload = {
  meta: {
    exercise_id: string;
    exercise_name: string;
    unit: "kg";
    generated_at?: string;
    timezone?: string;
  };
  cards: {
    current: {
      completed_at: string;
      top_weight: number;
      top_set: { weight_kg: number; reps: number; e1rm: number } | null;
    } | null;

    best_set: {
      e1rm: number;
      weight_kg: number;
      reps: number;
      completed_at: string;
    } | null;

    est_1rm: { value: number };
  };
  charts: {
    volume_trend: { date: string; volume: number }[];
    weight_vs_reps: {
      reps: number;
      weight_kg: number;
      e1rm: number;
      completed_at: string;
    }[];
    set_contribution: {
      set_number: number;
      volume: number;
      weight_kg: number;
      reps: number;
    }[];

    // ✅ NEW (add from backend)
    progress_over_time?: {
      date: string;
      top_weight: number;
      top_e1rm: number;
    }[];
  };
};

/* ---------------- utils ---------------- */

function n1(x: number | null | undefined) {
  if (x == null || !isFinite(x)) return "—";
  return x.toFixed(1);
}

function shortLabel(isoDate: string) {
  // isoDate is YYYY-MM-DD from backend
  const d = new Date(isoDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function ticks(min: number, max: number, n: number) {
  if (!isFinite(min) || !isFinite(max)) return [0];
  if (n <= 1) return [min];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + step * i);
}

function roundNice(x: number) {
  if (!isFinite(x)) return 0;
  if (x >= 200) return Math.round(x / 10) * 10;
  if (x >= 100) return Math.round(x / 5) * 5;
  if (x >= 50) return Math.round(x / 2) * 2;
  return Math.round(x);
}

function niceStep(x: number) {
  if (x >= 200) return 10;
  if (x >= 100) return 5;
  if (x >= 50) return 2;
  return 1;
}
function niceFloor(x: number) {
  const step = niceStep(x);
  return Math.floor(x / step) * step;
}
function niceCeil(x: number) {
  const step = niceStep(x);
  return Math.ceil(x / step) * step;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function stdev(values: number[]) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return 0;
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const variance =
    v.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (v.length - 1);
  return Math.sqrt(variance);
}

type Confidence = "low" | "medium" | "high";

function confidenceFromSeries(
  series: { top_weight: number; top_e1rm: number }[]
): Confidence {
  const n = series.length;

  // Primary driver: how much data we have
  if (n < 3) return "low";
  if (n < 6) return "medium";

  // Secondary driver: how noisy it is (very noisy => reduce confidence)
  const e1rms = series.map((p) => p.top_e1rm).filter((x) => Number.isFinite(x));
  const sd = stdev(e1rms);
  const mean =
    e1rms.length > 0 ? e1rms.reduce((s, x) => s + x, 0) / e1rms.length : 0;

  // Normalised noise (sd/mean). If mean is tiny, skip.
  const noise = mean > 0 ? sd / mean : 0;

  if (noise > 0.08) return "medium"; // noisy but usable
  return "high";
}

/* ---------------- charts ---------------- */

function ConfidencePill({
  level,
  colors,
  typography,
}: {
  level: Confidence;
  colors: any;
  typography: any;
}) {
  const label =
    level === "high"
      ? "High confidence"
      : level === "medium"
      ? "Med confidence"
      : "Low confidence";

  // Use your theme colors, but keep it subtle and readable
  const bg =
    level === "high"
      ? "rgba(34,197,94,0.14)"
      : level === "medium"
      ? "rgba(59,130,246,0.12)"
      : "rgba(148,163,184,0.16)";

  const fg =
    level === "high"
      ? colors.success ?? colors.primary
      : level === "medium"
      ? colors.primary
      : colors.textMuted;

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 12,
          fontFamily: typography.fontFamily.bold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function VolumeBars({
  points,
  height = 110,
  barColor = "rgba(37,99,235,0.18)",
}: {
  points: { date: string; volume: number }[];
  height?: number;
  barColor?: string;
}) {
  const maxV = Math.max(1, ...points.map((p) => p.volume || 0));
  return (
    <View style={{ marginTop: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 10,
          height,
        }}
      >
        {points.map((p) => {
          const h = Math.max(6, Math.round((p.volume / maxV) * height));
          return (
            <View
              key={p.date}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: 12,
                  backgroundColor: barColor,
                }}
              />
              <Text style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
                {shortLabel(p.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Scatter with:
 * - axes + tick labels
 * - 3 ISO-1RM lines (0.9x, 1.0x, 1.1x)
 * - ISO line labels on right
 */
function ScatterPlot({
  points,
  est1rm,
  width = 330,
  height = 210,
  unit = "kg",
}: {
  points: { reps: number; weight_kg: number }[];
  est1rm: number;
  width?: number;
  height?: number;
  unit?: string;
}) {
  const padL = 44;
  const padR = 46;
  const padT = 18;
  const padB = 34;

  const repsMin = Math.min(1, ...points.map((p) => p.reps));
  const repsMax = Math.max(5, ...points.map((p) => p.reps));

  const wMinRaw = Math.min(
    ...points.map((p) => p.weight_kg),
    est1rm > 0 ? est1rm / 2 : Infinity
  );
  const wMaxRaw = Math.max(...points.map((p) => p.weight_kg), est1rm || 0);

  const wMin = Math.max(0, roundNice(wMinRaw));
  const wMax = Math.max(wMin + 1, roundNice(wMaxRaw));

  const x = (reps: number) =>
    padL +
    ((reps - repsMin) / Math.max(1, repsMax - repsMin)) * (width - padL - padR);

  const y = (w: number) =>
    height -
    padB -
    ((w - wMin) / Math.max(1, wMax - wMin)) * (height - padT - padB);

  const xTicks = ticks(repsMin, repsMax, 4).map((t) => Math.round(t));
  const yTicks = ticks(wMin, wMax, 4).map((t) => roundNice(t));

  const isoWeight = (oneRm: number, reps: number) => oneRm / (1 + reps / 30);
  const isoLevels = est1rm > 0 ? [0.9, 1.0, 1.1] : [];
  const segs = 12;

  return (
    <View style={{ marginTop: 10 }}>
      <Svg width={width} height={height}>
        {/* axes */}
        <Line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={height - padB}
          stroke="rgba(148,163,184,0.55)"
          strokeWidth={2}
        />
        <Line
          x1={padL}
          y1={height - padB}
          x2={width - padR}
          y2={height - padB}
          stroke="rgba(148,163,184,0.55)"
          strokeWidth={2}
        />

        {/* y ticks */}
        {yTicks.map((t, i) => (
          <React.Fragment key={`yt-${i}`}>
            <Line
              x1={padL - 6}
              y1={y(t)}
              x2={padL}
              y2={y(t)}
              stroke="rgba(148,163,184,0.55)"
              strokeWidth={2}
            />
            <TextSvg
              x={padL - 10}
              y={y(t) + 4}
              size={10}
              color="rgba(148,163,184,0.9)"
              anchor="end"
            >
              {String(t)}
            </TextSvg>
          </React.Fragment>
        ))}

        {/* x ticks */}
        {xTicks.map((t, i) => (
          <React.Fragment key={`xt-${i}`}>
            <Line
              x1={x(t)}
              y1={height - padB}
              x2={x(t)}
              y2={height - padB + 6}
              stroke="rgba(148,163,184,0.55)"
              strokeWidth={2}
            />
            <TextSvg
              x={x(t)}
              y={height - padB + 18}
              size={10}
              color="rgba(148,163,184,0.9)"
              anchor="middle"
            >
              {String(t)}
            </TextSvg>
          </React.Fragment>
        ))}

        {/* axis titles */}
        <TextSvg
          x={width / 2}
          y={height - 8}
          size={11}
          color="rgba(148,163,184,0.9)"
          anchor="middle"
        >
          Reps
        </TextSvg>
        <TextSvg
          x={14}
          y={height / 2}
          size={11}
          color="rgba(148,163,184,0.9)"
          anchor="middle"
          rotate={{ deg: -90, cx: 14, cy: height / 2 }}
        >
          {`Weight (${unit})`}
        </TextSvg>

        {/* ISO lines + labels */}
        {isoLevels.map((m, idx) => {
          const oneRm = est1rm * m;

          return (
            <React.Fragment key={`iso-${m}`}>
              {Array.from({ length: segs }).map((_, i) => {
                const t0 = i / segs;
                const t1 = (i + 0.5) / segs;
                const r0 = repsMin + (repsMax - repsMin) * t0;
                const r1 = repsMin + (repsMax - repsMin) * t1;
                const w0 = isoWeight(oneRm, r0);
                const w1 = isoWeight(oneRm, r1);

                return (
                  <Line
                    key={`iso-${m}-${i}`}
                    x1={x(r0)}
                    y1={y(w0)}
                    x2={x(r1)}
                    y2={y(w1)}
                    stroke="rgba(148,163,184,0.55)"
                    strokeWidth={2}
                  />
                );
              })}

              {/* label near right */}
              <TextSvg
                x={width - padR + 4}
                y={y(isoWeight(oneRm, repsMax)) + 4}
                size={10}
                color="rgba(148,163,184,0.9)"
                anchor="start"
              >
                {`${Math.round(oneRm)} 1RM`}
              </TextSvg>
            </React.Fragment>
          );
        })}

        {/* points */}
        {points.map((p, idx) => (
          <Circle
            key={idx}
            cx={x(p.reps)}
            cy={y(p.weight_kg)}
            r={5}
            fill="rgba(37,99,235,0.78)"
          />
        ))}
      </Svg>

      <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Dots = sets. Lines = constant estimated 1RM (Epley). If dots move
        up/right you’re progressing.
      </Text>
    </View>
  );
}

/**
 * Two-line chart: top set weight + top set e1RM over time (per session)
 * Uses same axis (kg) so it’s instantly readable.
 */
function StrengthOverTime({
  points,
  width = 330,
  height = 190,
  unit = "kg",
}: {
  points: { date: string; top_weight: number; top_e1rm: number }[];
  width?: number;
  height?: number;
  unit?: string;
}) {
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 34;

  const ys = points
    .flatMap((p) => [p.top_weight, p.top_e1rm])
    .filter((v) => isFinite(v));

  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);
  // small padding so lines don't kiss the chart edges
  const yMin = Math.max(0, niceFloor(rawMin - 1));
  const yMax = Math.max(yMin + 1, niceCeil(rawMax + 1));

  const x = (i: number) => {
    const n = Math.max(1, points.length - 1);
    return padL + (i / n) * (width - padL - padR);
  };

  const y = (v: number) =>
    height -
    padB -
    ((v - yMin) / Math.max(1, yMax - yMin)) * (height - padT - padB);

  const yTicks = ticks(yMin, yMax, 4).map((t) => roundNice(t));

  const pathFrom = (vals: number[]) =>
    vals
      .map(
        (v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`
      )
      .join(" ");

  const weightPath = pathFrom(points.map((p) => p.top_weight));
  const e1rmPath = pathFrom(points.map((p) => p.top_e1rm));

  const WEIGHT_COLOR = "rgba(37,99,235,0.85)";
  const E1RM_COLOR = "rgba(34,197,94,0.85)";
  const LEGEND_TEXT = {
    fontSize: 12,
    opacity: 0.8,
    color: "rgba(15,23,42,0.85)",
  };

  return (
    <View style={{ marginTop: 10 }}>
      <Svg width={width} height={height}>
        {/* axes */}
        <Line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={height - padB}
          stroke="rgba(148,163,184,0.55)"
          strokeWidth={2}
        />
        <Line
          x1={padL}
          y1={height - padB}
          x2={width - padR}
          y2={height - padB}
          stroke="rgba(148,163,184,0.55)"
          strokeWidth={2}
        />

        {/* y ticks */}
        {yTicks.map((t, i) => (
          <React.Fragment key={`syt-${i}`}>
            <Line
              x1={padL - 6}
              y1={y(t)}
              x2={padL}
              y2={y(t)}
              stroke="rgba(148,163,184,0.55)"
              strokeWidth={2}
            />
            <TextSvg
              x={padL - 10}
              y={y(t) + 4}
              size={10}
              color="rgba(148,163,184,0.9)"
              anchor="end"
            >
              {String(t)}
            </TextSvg>
          </React.Fragment>
        ))}

        {/* lines */}
        <Path
          d={weightPath}
          stroke="rgba(37,99,235,0.85)"
          strokeWidth={3}
          fill="none"
        />
        <Path
          d={e1rmPath}
          stroke="rgba(34,197,94,0.85)"
          strokeWidth={3}
          fill="none"
        />

        {/* points */}
        {points.map((p, i) => (
          <React.Fragment key={p.date}>
            <Circle
              cx={x(i)}
              cy={y(p.top_weight)}
              r={4}
              fill="rgba(37,99,235,0.85)"
            />
            <Circle
              cx={x(i)}
              cy={y(p.top_e1rm)}
              r={4}
              fill="rgba(34,197,94,0.85)"
            />
          </React.Fragment>
        ))}
      </Svg>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <Text style={{ fontSize: 11, opacity: 0.7 }}>
          {shortLabel(points[0]?.date ?? "")}
        </Text>
        <Text style={{ fontSize: 11, opacity: 0.7 }}>
          {shortLabel(points[points.length - 1]?.date ?? "")}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 16,
          marginTop: 8,
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: WEIGHT_COLOR,
            }}
          />
          <Text style={LEGEND_TEXT}>Top set weight ({unit})</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: E1RM_COLOR,
            }}
          />
          <Text style={LEGEND_TEXT}>Est. 1RM ({unit})</Text>
        </View>
      </View>
    </View>
  );
}

function ContributionBars({
  sets,
  height = 120,
  barColor = "rgba(34,197,94,0.18)",
}: {
  sets: { set_number: number; volume: number }[];
  height?: number;
  barColor?: string;
}) {
  const maxV = Math.max(1, ...sets.map((s) => s.volume || 0));
  return (
    <View style={{ marginTop: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 10,
          height,
        }}
      >
        {sets.map((s) => {
          const h = Math.max(6, Math.round((s.volume / maxV) * height));
          return (
            <View
              key={s.set_number}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: 12,
                  backgroundColor: barColor,
                }}
              />
              <Text style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
                Set {s.set_number}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Which sets drove the session volume.
      </Text>
    </View>
  );
}

/**
 * Small helper to render text in SVG without pulling in extra libs.
 */
function TextSvg({
  x,
  y,
  children,
  size = 10,
  color = "rgba(148,163,184,0.9)",
  anchor = "start",
  rotate,
}: {
  x: number;
  y: number;
  children: React.ReactNode; // ✅ allow string parts
  size?: number;
  color?: string;
  anchor?: "start" | "middle" | "end";
  rotate?: { deg: number; cx: number; cy: number };
}) {
  return (
    <SvgText
      x={x}
      y={y}
      fontSize={size}
      fill={color}
      textAnchor={anchor}
      transform={
        rotate ? `rotate(${rotate.deg} ${rotate.cx} ${rotate.cy})` : undefined
      }
    >
      {children}
    </SvgText>
  );
}

/* ---------------- Screen ---------------- */

export default function DeepAnalytics({
  exerciseId: exerciseIdProp,
}: {
  exerciseId?: string;
}) {
  const { colors, typography } = useAppTheme();

  const params = useLocalSearchParams<{ exerciseId?: string }>();
  const exerciseId = useMemo(
    () => (exerciseIdProp ?? params.exerciseId ?? "").toString(),
    [exerciseIdProp, params.exerciseId]
  );

  const [data, setData] = useState<DeepAnalyticsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!exerciseId) {
        setErr("Missing exerciseId");
        setData(null);
        setLoading(false);
        return;
      }

      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      setErr(null);

      const { data: res, error } = await supabase.rpc(
        "get_exercise_deep_analytics",
        {
          p_exercise_id: exerciseId,
        }
      );

      if (error) {
        setErr(error.message);
        setData(null);
      } else {
        setData(res as any);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [exerciseId]
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  if (loading) return <LoadingScreen />;
  if (err) return <ErrorState title="Deep analytics failed" message={err} />;
  if (!data)
    return <ErrorState title="No data" message="Try another exercise." />;

  const name = data.meta.exercise_name;
  const unit = data.meta.unit;

  const current = data.cards.current;
  const best = data.cards.best_set;
  const est = data.cards.est_1rm?.value ?? 0;

  const vol = data.charts.volume_trend ?? [];
  const scatter = data.charts.weight_vs_reps ?? [];
  const contrib = data.charts.set_contribution ?? [];
  const series = (data.charts as any).strength_over_time ?? [];

  const confidence = confidenceFromSeries(series);

  return (
    <Screen>
      <ScreenHeader
        title="Deep analytics"
        right={
          <Icon name="stats-chart-outline" size={20} color={colors.textMuted} />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
          />
        }
      >
        {/* Title + subtitle */}
        <View>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 22,
            }}
          >
            {name}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>
            Personal trends · {unit.toUpperCase()}
          </Text>
        </View>

        {/* Top compact cards */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              CURRENT
            </Text>
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fontFamily.bold,
                fontSize: 20,
                marginTop: 6,
              }}
            >
              {current ? `${n1(current.top_weight)}${unit}` : "—"}
            </Text>
          </Card>

          <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              BEST SET
            </Text>
            <Text
              style={{
                color: colors.success,
                fontFamily: typography.fontFamily.bold,
                fontSize: 20,
                marginTop: 6,
              }}
            >
              {best ? `${n1(best.weight_kg)} × ${best.reps}` : "—"}
            </Text>
          </Card>

          <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              EST. 1RM
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontFamily: typography.fontFamily.bold,
                fontSize: 20,
                marginTop: 6,
              }}
            >
              {n1(est)}
              {unit}
            </Text>
          </Card>
        </View>

        {/* Epley explanation */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 14,
            }}
          >
            How estimated 1RM is calculated
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            We use the Epley formula:{" "}
            <Text style={{ fontFamily: typography.fontFamily.bold }}>
              1RM = weight × (1 + reps/30)
            </Text>
            . It’s an estimate based on the strongest sets you’ve logged.
          </Text>
        </Card>

        {/* Strength over time (NEW) */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fontFamily.bold,
                fontSize: 14,
              }}
            >
              Strength over time
            </Text>

            <ConfidencePill
              level={confidence}
              colors={colors}
              typography={typography}
            />
          </View>

          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            Progress = the lines trending upward. If 1RM rises while weight
            stays flat, you’re still getting stronger.
          </Text>

          {series.length ? (
            <StrengthOverTime points={series} unit={unit} />
          ) : (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>
              Not enough sessions yet.
            </Text>
          )}
        </Card>

        {/* Volume Trend */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 14,
            }}
          >
            Volume trend (recent)
          </Text>

          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            Higher bars over time = more total work. Even if weight stays flat,
            rising volume means you’re progressing.
          </Text>

          <View style={{ marginTop: 12 }}>
            {vol.length ? (
              <VolumeBars points={vol} />
            ) : (
              <Text style={{ color: colors.textMuted, marginTop: 6 }}>
                Not enough history yet.
              </Text>
            )}
          </View>
        </Card>

        {/* Weight vs reps */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 14,
            }}
          >
            Weight vs reps (ISO-1RM)
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            Are you lifting more weight at the same reps?
          </Text>

          {scatter.length ? (
            <ScatterPlot
              points={scatter.map((p) => ({
                reps: p.reps,
                weight_kg: p.weight_kg,
              }))}
              est1rm={est}
              unit={unit}
            />
          ) : (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>
              Not enough sets yet.
            </Text>
          )}
        </Card>

        {/* Set contribution */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 14,
            }}
          >
            Set contribution (latest session)
          </Text>

          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            Each bar is a set’s share of total session volume. More even bars =
            consistent effort. Big drop-offs can show fatigue or pacing issues.
          </Text>

          {/* ✅ chart gets its own vertical space */}
          <View style={{ marginTop: 12 }}>
            {contrib.length ? (
              <ContributionBars
                sets={contrib.map((s) => ({
                  set_number: s.set_number,
                  volume: s.volume,
                }))}
              />
            ) : (
              <Text style={{ color: colors.textMuted, marginTop: 6 }}>
                No session sets found.
              </Text>
            )}
          </View>
        </Card>

        <View style={{ height: 8 }} />
      </ScrollView>
    </Screen>
  );
}
