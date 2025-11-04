// app/features/muscles/muscle.tsx
import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Pressable,
} from "react-native";
import Svg, { G, Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { useAuth } from "../../../lib/useAuth";
import { useAppTheme } from "../../../lib/useAppTheme";
import { supabase } from "../../../lib/supabase";
import { router, useRouter } from "expo-router";

type Row = {
  muscle_name: string;
  muscle_volume: number;
  pct_of_week: number; // 0..100
};

const VIEW_NAME = "v_user_muscle_breakdown_last7d"; // <- change if your view name differs

export default function MuscleBreakdownScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const s = React.useMemo(() => styles(colors), [colors]);
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Row[]>([]);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from(VIEW_NAME)
          .select("muscle_name, muscle_volume, pct_of_week")
          .eq("user_id", userId)
          .order("pct_of_week", { ascending: false });

        if (!alive) return;
        if (error) {
          console.log("muscle view error", error);
          setRows([]);
        } else {
          setRows((data as Row[]) ?? []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const totalPct = rows.reduce((sum, r) => sum + Number(r.pct_of_week || 0), 0);
  const totalVol = rows.reduce(
    (sum, r) => sum + Number(r.muscle_volume || 0),
    0
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <View style={s.card}>
          <Text style={s.title}>Muscle Focus — Last 7 Days</Text>
          <Text style={s.subtle}>
            Total volume:{" "}
            <Text style={s.strong}>{formatNumber(totalVol)} kg</Text>
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 12 }} />
          ) : rows.length === 0 ? (
            <Text style={s.subtle}>
              No strength volume logged in the last 7 days.
            </Text>
          ) : (
            <PieWithLegend colors={colors} rows={rows} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- Pie chart with labels ---------------- */

function PieWithLegend({
  colors,
  rows,
  size = 260,
  strokeGap = 1,
}: {
  colors: any;
  rows: Row[];
  size?: number;
  strokeGap?: number;
}) {
  const data = rows
    .map((r) => ({
      ...r,
      pct_of_week: Math.max(0, Number(r.pct_of_week || 0)),
    }))
    .filter((r) => r.pct_of_week > 0);

  const totalPct = data.reduce((s, r) => s + r.pct_of_week, 0) || 1;

  // Config
  const LABEL_MIN_PCT = 4;
  const gutter = 80; // ← side padding for labels
  const width = size + gutter * 2; // ← wider SVG
  const height = size + 24; // (optional) a little extra vertical room

  const CX = gutter + size / 2; // ← center moved right by gutter
  const CY = height / 2;
  const OUTER_R = size * 0.36;
  const INNER_R = OUTER_R * 0.66;

  const palette = React.useMemo(
    () => makePalette(data.length, colors),
    [data.length, colors]
  );

  // Build arcs
  let start = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const slice = (d.pct_of_week / totalPct) * Math.PI * 2;
    const end = start + slice;
    const mid = (start + end) / 2;
    const path = donutSlicePath(
      CX,
      CY,
      OUTER_R,
      INNER_R,
      start,
      end,
      strokeGap
    );
    start = end;
    return { d, i, path, start, end, mid };
  });

  // Label candidates (only big enough slices)
  const leaderRadius = OUTER_R + 14;
  const labelRadius = OUTER_R + 28;

  const labelCandidates = arcs
    .filter((a) => a.d.pct_of_week >= LABEL_MIN_PCT)
    .map((a) => {
      const pLead = polarToCartesian(CX, CY, leaderRadius, a.mid);
      const pText = polarToCartesian(CX, CY, labelRadius, a.mid);
      const leftSide = Math.cos(a.mid) < 0;
      return {
        ...a,
        leftSide,
        // initial target text position
        tx: pText.x + (leftSide ? -6 : 6),
        ty: pText.y,
        lx: pLead.x,
        ly: pLead.y,
        anchor: leftSide ? ("end" as const) : ("start" as const),
        label: `${a.d.muscle_name} • ${Math.round(a.d.pct_of_week)}%`,
      };
    });

  // Collision resolve: keep a minimum vertical gap between labels
  const MIN_GAP = 14; // px between baselines
  const topBound = CY - OUTER_R - 40;
  const botBound = CY + OUTER_R + 40;

  // Resolve separately for left and right columns to avoid cross-column shoving
  function resolveColumn(col: typeof labelCandidates) {
    // sort by target y
    const items = [...col].sort((a, b) => a.ty - b.ty);
    let lastY = topBound;
    items.forEach((item) => {
      const y = Math.max(item.ty, lastY + MIN_GAP);
      item.ty = y;
      lastY = y;
    });
    // pull down items that overflow bottom bound by shifting up evenly
    const overflow = lastY - botBound;
    if (overflow > 0) {
      const step = overflow / (items.length || 1);
      for (let k = 0; k < items.length; k++) {
        items[k].ty -= step * (k + 1);
      }
    }
    return items;
  }

  const left = resolveColumn(labelCandidates.filter((c) => c.leftSide));
  const right = resolveColumn(labelCandidates.filter((c) => !c.leftSide));
  const resolved = [...left, ...right];

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, alignItems: "center" }}>
        <Svg width={width} height={height}>
          {/* Donut background */}
          <Circle cx={CX} cy={CY} r={OUTER_R} fill={colors.card} />
          {/* Slices */}
          <G>
            {arcs.map((a) => (
              <Path key={a.i} d={a.path} fill={palette[a.i]} />
            ))}
          </G>
        </Svg>

        {/* Center titles */}
        <View
          style={{
            position: "absolute",
            top: CY - 8,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Text
            style={{ color: colors.subtle, fontSize: 12, fontWeight: "800" }}
          >
            Muscles Breakdown
          </Text>
        </View>
      </View>

      {/* Smart list (tap to open details) */}
      <View style={{ marginTop: 16, width: "100%" }}>
        {data.map((d, i) => (
          <Pressable
            key={`row-${i}`}
            onPress={() =>
              router.push({
                pathname: "/features/home/muscleDetail",
                params: {
                  muscle: d.muscle_name,
                  // optional: pass window="7d" if you add periods later
                },
              })
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderColor: colors.border,
            }}
          >
            {/* color block */}
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: palette[i],
                marginRight: 10,
              }}
            />

            {/* name */}
            <Text
              style={{ color: colors.text, fontWeight: "800", flex: 1 }}
              numberOfLines={1}
            >
              {d.muscle_name}
            </Text>

            {/* right-side stats */}
            <Text style={{ color: colors.subtle, marginRight: 8 }}>
              {Math.round(d.pct_of_week)}%
            </Text>
            <Text style={{ color: colors.subtle }}>
              {formatNumber(Math.round(d.muscle_volume))} kg
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ---------------- Small SVG helpers ---------------- */

function TextSvg({
  x,
  y,
  children,
  textAnchor = "start",
  color = "#000",
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  textAnchor?: "start" | "middle" | "end";
  color?: string;
}) {
  return (
    <SvgText
      x={x}
      y={y}
      fill={color}
      fontSize={12}
      fontWeight="700"
      textAnchor={textAnchor}
      alignmentBaseline="middle"
    >
      {children}
    </SvgText>
  );
}

function donutSlicePath(
  cx: number,
  cy: number,
  r: number,
  ir: number,
  start: number,
  end: number,
  gap: number
) {
  // shrink angles slightly to produce tiny gaps between slices
  const shrink = end - start === 0 ? 0 : Math.min(0.006, (end - start) * 0.02);
  const a0 = start + shrink;
  const a1 = end - shrink;

  const p0 = polarToCartesian(cx, cy, r, a0);
  const p1 = polarToCartesian(cx, cy, r, a1);
  const p2 = polarToCartesian(cx, cy, ir, a1);
  const p3 = polarToCartesian(cx, cy, ir, a0);

  const largeArc = a1 - a0 > Math.PI ? 1 : 0;

  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${ir} ${ir} 0 ${largeArc} 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/* ---------------- Utilities + styles ---------------- */

function makePalette(n: number, colors: any) {
  // Use theme-friendly base then sweep hues for variety
  // Falls back to HSL spectrum if many slices.
  const base = colors.primary || "#0b6aa9";
  const arr: string[] = [];
  for (let i = 0; i < n; i++) {
    const hue = Math.round((360 * i) / Math.max(1, n));
    // Avoid too-dark colors in dark mode: keep lightness around 55–60%
    arr.push(`hsl(${hue} 70% 55%)`);
  }
  if (n === 1) return [base];
  return arr;
}

function formatNumber(n: number) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}

const styles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 6,
      textAlign: "center",
    },
    subtle: { color: colors.subtle, textAlign: "center", marginBottom: 12 },
    strong: { color: colors.text, fontWeight: "800" },
  });
