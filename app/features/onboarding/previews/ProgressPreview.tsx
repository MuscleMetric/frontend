import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

/* ---------- demo types ---------- */
type DemoWorkout = {
  id: string;
  title: string;
  durationMin: number;
  items: string[];
  notes?: string;
  waterMl?: number[]; // per “timepoint” in session
};

type DemoExercise = {
  id: string;
  name: string;
  type: "strength" | "cardio";
  last: string; // "2d ago"
};

/* ---------- small UI atoms ---------- */
function MiniBar({ value, colors }: { value: number; colors: any }) {
  return (
    <View
      style={{
        height: 10,
        borderRadius: 999,
        backgroundColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.max(4, Math.min(100, value))}%`,
          height: "100%",
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}

function Dot({ colors }: { colors: any }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
        marginRight: 8,
      }}
    />
  );
}

/* ---------- chart helpers ---------- */
type Point = { xLabel: string; y: number };

// bars with date labels at bottom
function MiniBarsDates({
  colors,
  points,
  formatTop,
}: {
  colors: any;
  points: Point[];
  formatTop: (y: number) => string;
}) {
  const max = Math.max(...points.map((p) => p.y), 1);

  return (
    <View
      style={{
        height: 170,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 10,
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      {points.map((p, i) => {
        const h = Math.round((p.y / max) * 110);
        return (
          <View key={i} style={{ alignItems: "center" }}>
            <Text style={{ color: colors.subtle, fontSize: 11, marginBottom: 6, fontWeight: "700" }}>
              {formatTop(p.y)}
            </Text>
            <View
              style={{
                width: 26,
                height: Math.max(8, h),
                borderRadius: 6,
                backgroundColor: colors.primary,
              }}
            />
            <Text style={{ color: colors.subtle, marginTop: 6, fontSize: 12, fontWeight: "700" }}>
              {p.xLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// “line” chart using vertical markers (cheap, no SVG dependency)
function MiniLine({
  colors,
  points,
  formatY,
}: {
  colors: any;
  points: Point[];
  formatY: (y: number) => string;
}) {
  const max = Math.max(...points.map((p) => p.y), 1);
  const min = Math.min(...points.map((p) => p.y), max);

  return (
    <View
      style={{
        marginTop: 8,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.subtle, fontWeight: "800", fontSize: 12 }}>
          {formatY(max)}
        </Text>
        <Text style={{ color: colors.subtle, fontWeight: "800", fontSize: 12 }}>
          {formatY(min)}
        </Text>
      </View>

      <View style={{ height: 110, marginTop: 8, flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        {points.map((p, i) => {
          const t = (p.y - min) / Math.max(1, max - min);
          const h = 20 + Math.round(t * 80); // always visible
          return (
            <View key={i} style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 10,
                  height: h,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                  opacity: 0.9,
                }}
              />
              <Text style={{ color: colors.subtle, marginTop: 8, fontSize: 12, fontWeight: "700" }}>
                {p.xLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// “scatter” (weight vs reps) as bubbles
function MiniScatter({
  colors,
  points,
}: {
  colors: any;
  points: Array<{ reps: number; weight: number }>;
}) {
  const maxW = Math.max(...points.map((p) => p.weight), 1);
  const minW = Math.min(...points.map((p) => p.weight), maxW);
  const maxR = Math.max(...points.map((p) => p.reps), 1);

  return (
    <View
      style={{
        marginTop: 8,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 12,
      }}
    >
      <Text style={{ color: colors.subtle, fontWeight: "800", fontSize: 12 }}>
        Heavier + fewer reps tends to be strength work
      </Text>

      <View style={{ height: 120, marginTop: 10 }}>
        {points.map((p, i) => {
          const x = (p.reps / maxR) * 260; // “width-ish”
          const y = (1 - (p.weight - minW) / Math.max(1, maxW - minW)) * 90;
          const size = 10 + Math.max(0, (p.weight - minW) / Math.max(1, maxW - minW)) * 10;

          return (
            <View
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: size,
                height: size,
                borderRadius: 999,
                backgroundColor: colors.primary,
                opacity: 0.85,
              }}
            />
          );
        })}

        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, backgroundColor: colors.border }} />
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 1, backgroundColor: colors.border }} />

        <Text style={{ position: "absolute", bottom: -2, right: 0, color: colors.subtle, fontWeight: "800", fontSize: 12 }}>
          reps →
        </Text>
        <Text style={{ position: "absolute", top: -2, left: 6, color: colors.subtle, fontWeight: "800", fontSize: 12 }}>
          ↑ weight
        </Text>
      </View>
    </View>
  );
}

// “water” graph (session hydration) as small bars
function MiniWater({
  colors,
  ml,
}: {
  colors: any;
  ml: number[];
}) {
  const max = Math.max(...ml, 1);

  return (
    <View
      style={{
        marginTop: 8,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 12,
      }}
    >
      <Text style={{ color: colors.subtle, fontWeight: "800", fontSize: 12 }}>
        Water during session (ml)
      </Text>

      <View style={{ height: 90, marginTop: 10, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {ml.map((v, i) => {
          const h = Math.max(6, Math.round((v / max) * 70));
          return (
            <View key={i} style={{ alignItems: "center" }}>
              <View style={{ width: 16, height: h, borderRadius: 6, backgroundColor: colors.primary, opacity: 0.6 }} />
            </View>
          );
        })}
      </View>

      <Text style={{ marginTop: 10, color: colors.subtle, fontWeight: "800" }}>
        Total: {ml.reduce((a, b) => a + b, 0).toLocaleString()} ml
      </Text>
    </View>
  );
}

export function ProgressPreview() {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // ---- Demo “filled account” ----
  const demoWorkouts: DemoWorkout[] = [
    {
      id: "w1",
      title: "Push A",
      durationMin: 54,
      items: ["Bench Press – 3×6", "Incline DB Press – 3×8", "Lateral Raise – 3×12"],
      notes: "Felt strong. Add 2.5kg next week.",
      waterMl: [120, 80, 150, 0, 180, 100],
    },
    {
      id: "w2",
      title: "Pull A",
      durationMin: 49,
      items: ["Pull-Up – 3×AMRAP", "DB Row – 3×8", "Hammer Curls – 2×10"],
      waterMl: [100, 100, 60, 120, 80, 0],
    },
    {
      id: "w3",
      title: "Legs A",
      durationMin: 58,
      items: ["Back Squat – 3×6", "RDL – 3×8", "Leg Curl – 3×10"],
      waterMl: [150, 120, 90, 140, 100, 60],
    },
  ];

  const demoExercises: DemoExercise[] = [
    { id: "e1", name: "Barbell Bench Press", type: "strength", last: "2d ago" },
    { id: "e2", name: "Lat Pulldown", type: "strength", last: "4d ago" },
    { id: "e3", name: "Back Squat", type: "strength", last: "6d ago" },
    { id: "e4", name: "Treadmill Run", type: "cardio", last: "8d ago" },
  ];

  const [selectedId, setSelectedId] = useState(demoExercises[0].id);
  const selected = demoExercises.find((x) => x.id === selectedId) ?? demoExercises[0];
  const isCardio = selected.type === "cardio";

  // realistic x-axis labels (dates)
  const dateLabels = ["Jan 1", "Jan 4", "Jan 7", "Jan 10", "Jan 13", "Jan 16", "Jan 19"];

  // strength / cardio datasets
  const volumePoints: Point[] = [12400, 13800, 15200, 14700, 16300, 17100, 18340].map((y, i) => ({
    xLabel: dateLabels[i],
    y,
  }));

  const distancePoints: Point[] = [3.2, 4.1, 5.4, 4.9, 6.2, 5.8, 6.0].map((y, i) => ({
    xLabel: dateLabels[i],
    y,
  }));

  const weightOverTime: Point[] = [82.5, 85, 87.5, 90, 92.5, 95, 97.5].map((y, i) => ({
    xLabel: dateLabels[i],
    y,
  }));

  const weightVsReps = [
    { reps: 10, weight: 70 },
    { reps: 8, weight: 77.5 },
    { reps: 6, weight: 85 },
    { reps: 5, weight: 90 },
    { reps: 3, weight: 95 },
  ];

  const kpis = isCardio
    ? [
        { label: "Best Distance", value: "6.2 km", accent: "success" as const },
        { label: "Best Pace", value: "5:18 /km", accent: "success" as const },
        { label: "Sessions", value: "12", accent: "none" as const },
      ]
    : [
        { label: "Current", value: "92.5kg", accent: "none" as const },
        { label: "Best Set", value: "95kg × 5", accent: "success" as const },
        { label: "Est. 1RM", value: "111kg", accent: "warning" as const },
      ];

  const lastWorkout = demoWorkouts[0];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header row */}
      <View style={s.rowBetween}>
        <Text style={s.h2}>Progress</Text>
        <Text style={s.link}>See all ›</Text>
      </View>

      {/* Last workouts carousel */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {demoWorkouts.map((w) => (
            <View key={w.id} style={[s.card, { width: 290 }]}>
              <View style={[s.rowBetween, { marginBottom: 6 }]}>
                <Text style={s.muted}>Last Workout</Text>
                <Text style={s.muted}>{w.durationMin}min</Text>
              </View>

              <Text style={s.title}>{w.title}</Text>

              <View style={{ height: 8 }} />
              {w.items.slice(0, 4).map((line, idx) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <Dot colors={colors} />
                  <Text style={s.itemText}>{line}</Text>
                </View>
              ))}

              {w.notes ? (
                <>
                  <View style={s.hr} />
                  <Text style={s.subhead}>Workout Notes</Text>
                  <Text style={s.notes} numberOfLines={2}>
                    “{w.notes}”
                  </Text>
                </>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Exercise selector */}
      <View style={s.card}>
        <Text style={s.h3}>Exercises</Text>

        <View style={{ marginTop: 8, gap: 8 }}>
          {demoExercises.map((ex) => {
            const active = ex.id === selectedId;
            return (
              <Pressable
                key={ex.id}
                onPress={() => setSelectedId(ex.id)}
                style={[
                  s.selectorRow,
                  active && {
                    backgroundColor: colors.surface,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.selectorTitle, active && { color: colors.primary }]} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text style={s.muted}>
                    {ex.type} • last trained {ex.last}
                  </Text>
                </View>
                <Text style={s.muted}>›</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Selected exercise stats */}
      <View style={s.card}>
        <Text style={s.h3}>Selected Exercise</Text>
        <Text style={[s.titleSm, { marginTop: 6 }]} numberOfLines={1}>
          {selected.name}
        </Text>

        {/* KPI row */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {kpis.map((k) => {
            const color =
              k.accent === "success"
                ? "#22c55e"
                : k.accent === "warning"
                ? "#f59e0b"
                : colors.text;

            return (
              <View key={k.label} style={s.kpi}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={[s.kpiValue, { color }]}>{k.value}</Text>
              </View>
            );
          })}
        </View>

        {/* Graph 1: volume/distance with DATE labels */}
        <View style={[s.rowBetween, { marginTop: 14 }]}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            {isCardio ? "Distance (recent)" : "Training volume (recent)"}
          </Text>
          <Text style={{ color: colors.subtle, fontWeight: "800" }}>ⓘ</Text>
        </View>

        <MiniBarsDates
          colors={colors}
          points={isCardio ? distancePoints : volumePoints}
          formatTop={(y) => (isCardio ? `${y.toFixed(1)} km` : `${Math.round(y / 1000)}k`)}
        />

        {/* Graph 2: weight over time (line-ish) */}
        {!isCardio && (
          <>
            <View style={[s.rowBetween, { marginTop: 14 }]}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Weight over time
              </Text>
              <Text style={{ color: colors.subtle, fontWeight: "800" }}>ⓘ</Text>
            </View>

            <MiniLine
              colors={colors}
              points={weightOverTime}
              formatY={(y) => `${y.toFixed(1)} kg`}
            />
          </>
        )}

        {/* Graph 3: weight vs reps (scatter-ish) */}
        {!isCardio && (
          <>
            <View style={[s.rowBetween, { marginTop: 14 }]}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Weight vs reps
              </Text>
              <Text style={{ color: colors.subtle, fontWeight: "800" }}>ⓘ</Text>
            </View>

            <MiniScatter colors={colors} points={weightVsReps} />
          </>
        )}

        {/* Graph 4: last workout water */}
        {!!lastWorkout.waterMl?.length && (
          <>
            <View style={[s.rowBetween, { marginTop: 14 }]}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Last workout hydration
              </Text>
              <Text style={{ color: colors.subtle, fontWeight: "800" }}>ⓘ</Text>
            </View>

            <MiniWater colors={colors} ml={lastWorkout.waterMl} />
          </>
        )}

        {/* weekly goal bar */}
        <View style={{ marginTop: 14, gap: 8 }}>
          <View style={s.rowBetween}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Weekly goal</Text>
            <Text style={{ color: colors.subtle, fontWeight: "900" }}>2 / 3 • On track</Text>
          </View>
          <MiniBar value={67} colors={colors} />
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    h2: { fontSize: 20, fontWeight: "900", color: colors.text },
    h3: { fontSize: 16, fontWeight: "900", color: colors.text },
    link: { color: colors.primary, fontWeight: "800" },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    title: { fontSize: 18, fontWeight: "900", color: colors.text },
    titleSm: { fontSize: 16, fontWeight: "900", color: colors.text },
    itemText: { color: colors.text, fontWeight: "700" },

    subhead: { color: colors.text, fontWeight: "800", marginTop: 6, marginBottom: 4 },
    notes: { color: colors.subtle, fontStyle: "italic", fontWeight: "700" },
    hr: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

    muted: { color: colors.subtle, fontWeight: "700" },

    kpi: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    kpiLabel: { color: colors.subtle, fontSize: 12, marginBottom: 4, fontWeight: "800" },
    kpiValue: { color: colors.text, fontWeight: "900", fontSize: 18 },

    selectorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    selectorTitle: { fontWeight: "900", color: colors.text, fontSize: 16 },
  });
