import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { Screen, ScreenHeader, Card, LoadingScreen, ErrorState } from "@/ui";
import Svg, { Circle, Line, Rect } from "react-native-svg";

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
    weight_vs_reps: { reps: number; weight_kg: number; e1rm: number; completed_at: string }[];
    set_contribution: { set_number: number; volume: number; weight_kg: number; reps: number }[];
  };
};

function fmtDateShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

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

/** ---------- Mini Charts (clean + lightweight) ---------- */

function VolumeBars({
  points,
  height = 110,
}: {
  points: { date: string; volume: number }[];
  height?: number;
}) {
  const maxV = Math.max(1, ...points.map((p) => p.volume || 0));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height }}>
        {points.map((p) => {
          const h = Math.max(6, Math.round((p.volume / maxV) * height));
          return (
            <View key={p.date} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
              <View
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: 10,
                  backgroundColor: "rgba(37,99,235,0.18)",
                }}
              />
              <Text style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>{shortLabel(p.date)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ScatterPlot({
  points,
  est1rm,
  width = 320,
  height = 190,
}: {
  points: { reps: number; weight_kg: number }[];
  est1rm: number;
  width?: number;
  height?: number;
}) {
  const padding = 20;

  const repsMin = Math.min(1, ...points.map((p) => p.reps));
  const repsMax = Math.max(5, ...points.map((p) => p.reps));
  const wMin = Math.min(...points.map((p) => p.weight_kg), est1rm ? est1rm / 2 : Infinity);
  const wMax = Math.max(...points.map((p) => p.weight_kg), est1rm || 0);

  const x = (reps: number) =>
    padding + ((reps - repsMin) / Math.max(1, repsMax - repsMin)) * (width - padding * 2);

  const y = (w: number) =>
    height - padding - ((w - wMin) / Math.max(1, wMax - wMin)) * (height - padding * 2);

  // Iso-1RM line using Epley rearranged: weight = 1rm / (1 + reps/30)
  const linePts = [repsMin, repsMax].map((r) => ({
    r,
    w: est1rm > 0 ? est1rm / (1 + r / 30) : 0,
  }));

  return (
    <View style={{ marginTop: 10 }}>
      <Svg width={width} height={height}>
        {/* axes */}
        <Line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(148,163,184,0.35)" />
        <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(148,163,184,0.35)" />

        {/* iso-1rm dashed-ish (simple segments) */}
        {est1rm > 0 && (
          <>
            {Array.from({ length: 12 }).map((_, i) => {
              const t0 = i / 12;
              const t1 = (i + 0.5) / 12;
              const r0 = linePts[0].r + (linePts[1].r - linePts[0].r) * t0;
              const r1 = linePts[0].r + (linePts[1].r - linePts[0].r) * t1;
              const w0 = est1rm / (1 + r0 / 30);
              const w1 = est1rm / (1 + r1 / 30);
              return (
                <Line
                  key={i}
                  x1={x(r0)}
                  y1={y(w0)}
                  x2={x(r1)}
                  y2={y(w1)}
                  stroke="rgba(148,163,184,0.55)"
                  strokeWidth={2}
                />
              );
            })}
          </>
        )}

        {/* points */}
        {points.map((p, idx) => (
          <Circle key={idx} cx={x(p.reps)} cy={y(p.weight_kg)} r={5} fill="rgba(37,99,235,0.75)" />
        ))}
      </Svg>

      <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Each dot is a logged set. Line shows “same 1RM” (Epley).
      </Text>
    </View>
  );
}

function ContributionBars({
  sets,
  height = 120,
}: {
  sets: { set_number: number; volume: number }[];
  height?: number;
}) {
  const maxV = Math.max(1, ...sets.map((s) => s.volume || 0));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height }}>
        {sets.map((s) => {
          const h = Math.max(6, Math.round((s.volume / maxV) * height));
          return (
            <View key={s.set_number} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
              <View
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: 10,
                  backgroundColor: "rgba(34,197,94,0.18)",
                }}
              />
              <Text style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>Set {s.set_number}</Text>
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

/** ---------- Screen ---------- */

export default function DeepAnalytics({ exerciseId: exerciseIdProp }: { exerciseId?: string }) {
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

      const { data: res, error } = await supabase.rpc("get_exercise_deep_analytics", {
        p_exercise_id: exerciseId,
      });

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
  if (!data) return <ErrorState title="No data" message="Try another exercise." />;

  const name = data.meta.exercise_name;
  const unit = data.meta.unit;

  const current = data.cards.current;
  const best = data.cards.best_set;
  const est = data.cards.est_1rm?.value ?? 0;

  const vol = data.charts.volume_trend ?? [];
  const scatter = data.charts.weight_vs_reps ?? [];
  const contrib = data.charts.set_contribution ?? [];

  return (
    <Screen>
      <ScreenHeader title="Deep analytics" />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        {/* Title + subtitle like the reference */}
        <View>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 22 }}>
            {name}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>
            Personal trends · {unit.toUpperCase()}
          </Text>
        </View>

        {/* Top compact cards like the reference */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>CURRENT</Text>
            <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 20, marginTop: 6 }}>
              {current ? `${n1(current.top_weight)}${unit}` : "—"}
            </Text>
          </Card>

          <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>BEST SET</Text>
            <Text style={{ color: colors.success, fontFamily: typography.fontFamily.bold, fontSize: 20, marginTop: 6 }}>
              {best ? `${n1(best.weight_kg)} × ${best.reps}` : "—"}
            </Text>
          </Card>

          <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>EST. 1RM</Text>
            <Text style={{ color: colors.primary, fontFamily: typography.fontFamily.bold, fontSize: 20, marginTop: 6 }}>
              {n1(est)}
              {unit}
            </Text>
          </Card>
        </View>

        {/* Epley explanation (simple, user-facing) */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
            How estimated 1RM is calculated
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            We use the Epley formula: <Text style={{ fontFamily: typography.fontFamily.bold }}>1RM = weight × (1 + reps/30)</Text>.
            It’s an estimate based on the strongest sets you’ve logged.
          </Text>
        </Card>

        {/* Volume Trend */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
            Volume trend (recent)
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            Total session volume for this exercise.
          </Text>

          {vol.length ? <VolumeBars points={vol} /> : <Text style={{ color: colors.textMuted, marginTop: 10 }}>Not enough history yet.</Text>}
        </Card>

        {/* Weight vs reps */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
            Weight vs reps (ISO-1RM)
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            Are you lifting more weight at the same reps?
          </Text>

          {scatter.length ? (
            <ScatterPlot points={scatter.map((p) => ({ reps: p.reps, weight_kg: p.weight_kg }))} est1rm={est} />
          ) : (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>Not enough sets yet.</Text>
          )}
        </Card>

        {/* Set contribution */}
        <Card style={{ padding: 12, borderRadius: 18 }}>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
            Set contribution (latest session)
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6 }}>
            Which sets contributed most to your total work.
          </Text>

          {contrib.length ? <ContributionBars sets={contrib.map((s) => ({ set_number: s.set_number, volume: s.volume }))} /> : <Text style={{ color: colors.textMuted, marginTop: 10 }}>No session sets found.</Text>}
        </Card>

        <View style={{ height: 8 }} />
      </ScrollView>
    </Screen>
  );
}
