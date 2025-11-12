// app/features/home/prDetail.tsx
import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../../../lib/useAuth";
import { useAppTheme } from "../../../lib/useAppTheme";
import { supabase } from "../../../lib/supabase";
import Svg, { Polyline, Line, Circle } from "react-native-svg";

type Pt = {
  day: string;                 
  e1rm: number | null;
  max_weight: number | null;
  reps_for_max?: number | null;
  e1rm_src_weight?: number | null;
  e1rm_src_reps?: number | null;
};

type RangeKey = "7D" | "1M" | "3M" | "1Y" | "ALL";
type RangeOpt = { key: RangeKey; days: number };
type AllowedRange = RangeOpt & { disabled: boolean };

const RANGES: RangeOpt[] = [
  { key: "7D", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "1Y", days: 365 },
  { key: "ALL", days: 3650 },
];

type Metric = "e1rm" | "max_weight";
const METRIC_LABEL: Record<Metric, string> = {
  e1rm: "e1RM",
  max_weight: "Max Weight",
};

export default function PRDetailScreen() {
  const { exerciseId, name } = useLocalSearchParams<{ exerciseId: string; name: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const s = React.useMemo(() => styles(colors), [colors]);

  const [loading, setLoading] = React.useState(true);
  const [range, setRange] = React.useState<RangeOpt>(RANGES[0]);       
  const [series, setSeries] = React.useState<Pt[]>([]);
  const [earliestISO, setEarliestISO] = React.useState<string | null>(null);
  const [metric, setMetric] = React.useState<Metric>("max_weight");     

  React.useEffect(() => {
    if (!userId || !exerciseId) return;
    (async () => {
      setLoading(true);
      try {
        // Range-limited series
        const { data, error } = await supabase.rpc("get_user_pr_series", {
          p_user_id: userId,
          p_exercise_id: exerciseId,
          p_lookback_days: range.days,
        });
        if (error) throw error;
        setSeries((data ?? []) as Pt[]);

        // Find earliest day across entire history (for range gating)
        const { data: allData } = await supabase.rpc("get_user_pr_series", {
          p_user_id: userId,
          p_exercise_id: exerciseId,
          p_lookback_days: 36500,
        });
        const all = (allData ?? []) as Pt[];
        if (all.length) {
          const minIso = all.reduce((min, p) => (p.day < min ? p.day : min), all[0].day);
          setEarliestISO(minIso);
        } else {
          setEarliestISO(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, exerciseId, range]);

  const allowedRanges: AllowedRange[] = React.useMemo(() => {
    if (!earliestISO) return RANGES.map((r) => ({ ...r, disabled: false }));
    const earliest = new Date(earliestISO);
    const now = new Date();
    const daysHave = Math.max(
      1,
      Math.floor((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
    return RANGES.map((r) => ({
      ...r,
      disabled: r.key !== "ALL" && r.days > daysHave,
    }));
  }, [earliestISO]);

  const valueFor = React.useCallback(
    (p: Pt | undefined | null) =>
      p ? (metric === "e1rm" ? Number(p.e1rm ?? 0) : Number(p.max_weight ?? 0)) : 0,
    [metric]
  );

  const clean = series.filter((p) => valueFor(p) > 0);
  const latest = clean.at(-1);
  const prev = clean.length >= 2 ? clean[clean.length - 2] : undefined;
  const best = clean.reduce(
    (m, p) => (valueFor(p) > (m ? valueFor(m) : 0) ? p : m),
    undefined as Pt | undefined
  );

  const latestVal = valueFor(latest);
  const prevVal = valueFor(prev);
  const bestVal = valueFor(best);

  const pct = latest && prev && prevVal > 0 ? ((latestVal - prevVal) / prevVal) * 100 : null;
  const delta = latest && prev ? latestVal - prevVal : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Header */}
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={s.link}>← Back</Text>
          </Pressable>
          <Text style={s.header} numberOfLines={1}>{name ?? "Exercise"}</Text>
          <View style={{ width: 52 }} />
        </View>

        {/* Range switches */}
        <View style={s.rangeRow}>
          {allowedRanges.map((r) => {
            const active = r.key === range.key;
            return (
              <Pressable
                key={r.key}
                disabled={!!r.disabled}
                onPress={() => setRange(r)}
                style={[
                  s.rangeChip,
                  active && { backgroundColor: colors.primaryBg },
                  r.disabled && { opacity: 0.4 },
                ]}
              >
                <Text style={[s.rangeText, active && { color: colors.primaryText, fontWeight: "800" }]}>
                  {r.key}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Metric switch */}
        <View style={s.metricRow}>
          {(["e1rm", "max_weight"] as Metric[]).map((m) => {
            const active = m === metric;
            return (
              <Pressable
                key={m}
                onPress={() => setMetric(m)}
                style={[
                  s.metricChip,
                  active && { backgroundColor: colors.primaryBg, borderColor: colors.primaryBg },
                ]}
              >
                <Text style={[s.metricText, active && { color: colors.primaryText, fontWeight: "800" }]}>
                  {METRIC_LABEL[m]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Summary metrics */}
        <View style={s.metricsCard}>
          {loading ? (
            <ActivityIndicator />
          ) : clean.length === 0 ? (
            <Text style={s.subtle}>No PR data yet in this range.</Text>
          ) : (
            <>
              <Text style={s.bigStat}>
                {fmt(latestVal)} kg <Text style={s.subtle}>{METRIC_LABEL[metric]}</Text>
              </Text>
              <Text
                style={[
                  s.delta,
                  { color: pct == null ? colors.text : pct >= 0 ? colors.successText : colors.danger },
                ]}
              >
                {pct == null ? "—" : `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`}{" "}
                {delta != null && `(${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg)`}
              </Text>
              {best && (
                <Text style={s.subtle}>
                  Best in range: {fmt(bestVal)} kg on {shortDate(best.day)}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Chart */}
        <View style={s.chartCard}>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <LineChart
              colors={colors}
              data={clean.map((p) => ({
                x: new Date(p.day).getTime(),
                y: metric === "e1rm" ? Number(p.e1rm) : Number(p.max_weight),
                raw: p,
              }))}
              height={220}
              titleX="Date"
              titleY={metric === "e1rm" ? "e1RM (kg)" : "Max Weight (kg)"}
              metric={metric}
              rangeKey={range.key}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- Chart ---------------- */

function LineChart({
  colors,
  data,
  height = 220,
  titleX,
  titleY,
  metric,
  rangeKey,
}: {
  colors: any;
  data: { x: number; y: number; raw: Pt }[];
  height?: number;
  titleX?: string;
  titleY?: string;
  metric: "e1rm" | "max_weight";
  rangeKey: RangeKey;
}) {
  const [w, setW] = React.useState(0);
  const [hover, setHover] = React.useState<null | { cx: number; cy: number; pt: Pt }>(null);

  const pad = 16;
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs, Date.now());
  const maxX = Math.max(...xs, Date.now());
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const points = data.map((d) => {
    const x = pad + ((d.x - minX) / spanX) * innerW;
    const y = height - pad - ((d.y - minY) / spanY) * innerH;
    return { x, y, raw: d.raw };
  });

  const allowClick = rangeKey === "7D" || rangeKey === "1M";

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: "100%", height, position: "relative" }}>
      <Svg width={w} height={height}>
        {/* grid */}
        {Array.from({ length: 4 }).map((_, i) => {
          const yy = pad + (i * innerH) / 3;
          return <Line key={i} x1={pad} x2={w - pad} y1={yy} y2={yy} stroke={colors.border} strokeWidth={1} />;
        })}

        {/* polyline */}
        <Polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={colors.primaryText} strokeWidth={3} />

        {/* dots + hit areas (short ranges only) */}
        {allowClick &&
          points.map((p, idx) => (
            <React.Fragment key={idx}>
              <Circle cx={p.x} cy={p.y} r={4} fill={colors.primaryText} onPress={() => setHover({ cx: p.x, cy: p.y, pt: p.raw })} />
              <Circle cx={p.x} cy={p.y} r={14} fill="transparent" onPress={() => setHover({ cx: p.x, cy: p.y, pt: p.raw })} />
            </React.Fragment>
          ))}
      </Svg>

      {/* axis titles */}
      {!!titleX && (
        <Text
          style={{
            position: "absolute",
            bottom: 2,
            left: 0,
            right: 0,
            textAlign: "center",
            color: colors.subtle,
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          {titleX}
        </Text>
      )}
      {!!titleY && (
        <Text
          style={{
            position: "absolute",
            left: 0,
            top: height / 2,
            transform: [{ rotate: "-90deg" }, { translateY: -8 }],
            transformOrigin: "left top",
            color: colors.subtle,
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          {titleY}
        </Text>
      )}

      {/* tooltip */}
      {hover && (
        <View
          style={{
            position: "absolute",
            left: Math.min(Math.max(hover.cx - 80, 6), w - 160),
            top: Math.max(hover.cy - 44, 6),
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {metric === "e1rm" ? tagForE1RM(hover.pt) : tagForMax(hover.pt)}
          </Text>
        </View>
      )}
    </View>
  );
}

/* -------- tag helpers, misc -------- */

function tagForMax(p: Pt) {
  const w = p.max_weight != null ? Number(p.max_weight).toFixed(1) : "—";
  const reps = p.reps_for_max != null ? `${p.reps_for_max} reps` : null;
  const date = shortDate(p.day);
  return reps ? `${w} kg × ${reps} • ${date}` : `${w} kg • ${date}`;
}

function tagForE1RM(p: Pt) {
  const e = p.e1rm != null ? Number(p.e1rm).toFixed(1) : "—";
  const srcW = p.e1rm_src_weight != null ? `${Number(p.e1rm_src_weight).toFixed(1)} kg` : null;
  const srcR = p.e1rm_src_reps != null ? `${p.e1rm_src_reps} reps` : null;
  const src = srcW && srcR ? ` (${srcW} × ${srcR})` : srcW ? ` (${srcW})` : srcR ? ` (${srcR})` : "";
  const date = shortDate(p.day);
  return `${e} kg e1RM${src} • ${date}`;
}

function fmt(n?: number | null) {
  return n == null ? "—" : Number(n).toFixed(1);
}
function shortDate(d?: string) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(d));
  } catch {
    return d;
  }
}

const styles = (colors: any) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    link: { color: colors.primaryText, fontWeight: "700", width: 52 },
    header: { color: colors.text, fontSize: 18, fontWeight: "900", flex: 1, textAlign: "center" },
    rangeRow: { flexDirection: "row", gap: 8, marginTop: 8, justifyContent: "space-between" },
    rangeChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rangeText: { color: colors.text, fontSize: 12 },
    metricRow: { flexDirection: "row", gap: 8, marginTop: 6, justifyContent: "flex-start" },
    metricChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    metricText: { color: colors.text, fontSize: 12 },
    metricsCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 6,
    },
    bigStat: { color: colors.text, fontSize: 22, fontWeight: "900" },
    delta: { fontWeight: "900" },
    chartCard: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subtle: { color: colors.subtle },
  });
