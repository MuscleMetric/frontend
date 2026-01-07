import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

type DemoSet = {
  setNo: number;
  // strength
  weight?: number;
  reps?: number;
  // cardio-ish (optional, not used here)
  distance?: number;
  timeSec?: number;
  notes?: string | null;

  // dropset: multiple rows share same setNo
  isDrop?: boolean;
};

type DemoExercise = {
  id: string;
  name: string;
  type: string | null;
  sets: DemoSet[]; // can contain repeated setNo for dropsets
};

type Block =
  | { kind: "single"; order: number; ex: DemoExercise }
  | { kind: "superset"; order: number; groupId: string; items: DemoExercise[] };

function fmtDateTimeDemo() {
  // keep it deterministic-ish
  return "Tue • 19:12";
}

function fmtDuration(min: number) {
  return `${min}m`;
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString();
}

function volOfSet(s: DemoSet) {
  const reps = Number(s.reps ?? 0);
  const wt = Number(s.weight ?? 0);
  return reps * wt;
}

function Kpi({
  label,
  value,
  unit,
  colors,
}: {
  label: string;
  value: string;
  unit?: string;
  colors: any;
}) {
  const s = makeStyles(colors);
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={s.kpiNumber} numberOfLines={1}>
        {value}
        {!!unit && <Text style={s.kpiUnit}> {unit}</Text>}
      </Text>
    </View>
  );
}

function setLine(st: DemoSet) {
  const parts: string[] = [];
  if (st.weight != null && st.reps != null) parts.push(`${st.weight}kg x ${st.reps}`);
  else if (st.reps != null) parts.push(`${st.reps} reps`);
  if (st.timeSec != null) parts.push(`${st.timeSec}s`);
  if (st.distance != null) parts.push(`${st.distance}m`);
  if (st.notes) parts.push(`(${st.notes})`);
  return parts.join(" · ");
}

// group sets by setNo to render dropsets nicely
function renderSetsForExercise(ex: DemoExercise, colors: any) {
  const s = makeStyles(colors);

  const bySet = new Map<number, DemoSet[]>();
  for (const st of ex.sets) {
    const k = Number(st.setNo);
    bySet.set(k, [...(bySet.get(k) ?? []), st]);
  }
  const nums = Array.from(bySet.keys()).sort((a, b) => a - b);

  return nums.map((k) => {
    const rows = (bySet.get(k) ?? []).slice();
    const isDrop = rows.length > 1 || rows.some((r) => !!r.isDrop);

    return (
      <View key={`${ex.id}-set-${k}`} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={s.setNo}>#{k}</Text>
          {isDrop && (
            <View style={s.badgeDrop}>
              <Text style={s.badgeDropText}>DROPSET</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 6, marginLeft: 6, gap: 4 }}>
          {rows.map((row, i) => (
            <View key={`${ex.id}-${k}-${i}`} style={s.setRow}>
              {isDrop ? <Text style={s.dropIndex}>{i + 1}.</Text> : null}
              <Text style={s.setText}>{setLine(row)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  });
}

function supersetColorFor(groupId: string, colors: any) {
  const palette = [
    colors.primary,
    "#22c55e",
    "#a855f7",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
  ];

  let hash = 0;
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function HistoryDetailPreview() {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  // ✅ Demo data includes:
  // - SUPerset (2 exercises)
  // - Dropset (same setNo repeated)
  const blocks: Block[] = useMemo(() => {
    const supersetGroupId = "ss_demo_A";

    const supersetA1: DemoExercise = {
      id: "ex1",
      name: "Incline Dumbbell Press",
      type: "strength",
      sets: [
        { setNo: 1, weight: 32.5, reps: 10 },
        { setNo: 2, weight: 35, reps: 8 },
        { setNo: 3, weight: 35, reps: 8 },
      ],
    };

    const supersetA2: DemoExercise = {
      id: "ex2",
      name: "Lateral Raise",
      type: "strength",
      sets: [
        { setNo: 1, weight: 10, reps: 12 },
        { setNo: 2, weight: 12.5, reps: 12 },
        { setNo: 3, weight: 12.5, reps: 10, notes: "strict" },
      ],
    };

    const bench: DemoExercise = {
      id: "ex3",
      name: "Barbell Bench Press",
      type: "strength",
      sets: [
        { setNo: 1, weight: 80, reps: 6 },
        { setNo: 2, weight: 85, reps: 6 },
        { setNo: 3, weight: 90, reps: 5, notes: "pause" },
      ],
    };

    // ✅ Dropset example: set #3 has 3 “drops”
    const flyDropset: DemoExercise = {
      id: "ex4",
      name: "Machine Fly",
      type: "strength",
      sets: [
        { setNo: 1, weight: 55, reps: 12 },
        { setNo: 2, weight: 60, reps: 10 },

        // dropset group on set 3:
        { setNo: 3, weight: 62.5, reps: 8, isDrop: true },
        { setNo: 3, weight: 52.5, reps: 10, isDrop: true },
        { setNo: 3, weight: 42.5, reps: 12, isDrop: true },
      ],
    };

    return [
      { kind: "single", order: 0, ex: bench },
      { kind: "superset", order: 1, groupId: supersetGroupId, items: [supersetA1, supersetA2] },
      { kind: "single", order: 2, ex: flyDropset },
    ];
  }, []);

  const exercisesCount = useMemo(() => {
    let n = 0;
    for (const b of blocks) {
      if (b.kind === "single") n += 1;
      else n += b.items.length;
    }
    return n;
  }, [blocks]);

  const totalSets = useMemo(() => {
    let n = 0;
    for (const b of blocks) {
      if (b.kind === "single") n += b.ex.sets.length;
      else n += b.items.reduce((sum, ex) => sum + ex.sets.length, 0);
    }
    return n;
  }, [blocks]);

  const totalVolume = useMemo(() => {
    let v = 0;
    for (const b of blocks) {
      if (b.kind === "single") v += b.ex.sets.reduce((sum, st) => sum + volOfSet(st), 0);
      else {
        for (const ex of b.items) v += ex.sets.reduce((sum, st) => sum + volOfSet(st), 0);
      }
    }
    return v;
  }, [blocks]);

  const title = "Push Day";
  const durationMin = 52;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Back row (like the real page) */}
      <View style={{ marginBottom: 2 }}>
        <Pressable
          onPress={() => {}}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "800", marginRight: 4 }}>
            ←
          </Text>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "800" }}>Back</Text>
        </Pressable>
      </View>

      {/* Header card (KPIs + notes + share button) */}
      <View style={s.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={s.h2}>{title}</Text>
          <Text style={s.link}>Close</Text>
        </View>

        <Text style={s.muted}>{fmtDateTimeDemo()}</Text>
        <View style={{ height: 8 }} />

        <View style={s.kpiWrap}>
          <Kpi colors={colors} label="Duration" value={fmtDuration(durationMin)} />
          <Kpi colors={colors} label="Exercises" value={String(exercisesCount)} />
          <Kpi colors={colors} label="Total Sets" value={fmtInt(totalSets)} />
          <Kpi colors={colors} label="Total Volume" value={fmtInt(totalVolume)} unit="kg" />
        </View>

        <View style={s.hr} />
        <Text style={s.subhead}>Workout Notes</Text>
        <Text style={s.notes}>
          Warm up properly. Keep reps controlled. Leave 1–2 reps in reserve on set 1.
        </Text>

        <View style={{ height: 10 }} />
        <View style={[s.btn, s.primary, { alignSelf: "flex-start" }]}>
          <Text style={s.btnPrimaryText}>Share workout</Text>
        </View>
      </View>

      {/* Details card (Supersets + Dropsets) */}
      <View style={s.card}>
        <Text style={s.h3}>Details</Text>
        <View style={{ height: 8 }} />

        {(() => {
          let ssLetter = 0;

          return blocks.map((b) => {
            if (b.kind === "superset") {
              const letter = String.fromCharCode(65 + (ssLetter % 26));
              ssLetter++;

              const ssColor = supersetColorFor(b.groupId, colors);

              return (
                <View
                  key={`ss-${b.groupId}`}
                  style={[
                    s.supersetWrap,
                    { borderColor: ssColor, backgroundColor: colors.surface },
                  ]}
                >
                  <View style={[s.supersetRail, { backgroundColor: ssColor }]} />

                  <View style={{ flex: 1 }}>
                    <View style={s.supersetHeaderRow}>
                      <View
                        style={[
                          s.supersetBadge,
                          {
                            backgroundColor: `${ssColor}20`,
                            borderColor: `${ssColor}55`,
                          },
                        ]}
                      >
                        <Text style={[s.supersetBadgeText, { color: ssColor }]}>
                          SUPERSET {letter}
                        </Text>
                      </View>
                      <Text style={s.supersetHint}>Move fast • minimal rest</Text>
                    </View>

                    <View style={{ gap: 12 }}>
                      {b.items.map((ex, idx) => (
                        <View
                          key={ex.id}
                          style={[s.supersetExercise, idx > 0 ? s.supersetDividerTop : null]}
                        >
                          <Text style={s.exTitle}>
                            {ex.name}{" "}
                            <Text style={s.muted}>{ex.type ? `· ${ex.type}` : ""}</Text>
                          </Text>
                          {renderSetsForExercise(ex, colors)}
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            }

            return (
              <View key={b.ex.id} style={s.exBlock}>
                <Text style={s.exTitle}>
                  {b.ex.name}{" "}
                  <Text style={s.muted}>{b.ex.type ? `· ${b.ex.type}` : ""}</Text>
                </Text>
                {renderSetsForExercise(b.ex, colors)}
              </View>
            );
          });
        })()}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    h2: { fontSize: 20, fontWeight: "900", color: colors.text, marginBottom: 2 },
    h3: { fontSize: 16, fontWeight: "900", color: colors.text },

    muted: { color: colors.subtle, fontWeight: "700" },
    link: { color: colors.primary, fontWeight: "800" },

    hr: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

    subhead: { color: colors.text, fontWeight: "800", marginTop: 2, marginBottom: 4 },
    notes: { color: colors.subtle, fontWeight: "700" },

    kpiWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
    kpiCard: {
      flexGrow: 1,
      flexBasis: "47%",
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    kpiLabel: { color: colors.subtle, fontSize: 13, marginBottom: 6, fontWeight: "800" },
    kpiNumber: { color: colors.text, fontWeight: "900", fontSize: 22, lineHeight: 26 },
    kpiUnit: { color: colors.subtle, fontWeight: "900", fontSize: 14 },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "900" },

    // Details
    exBlock: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 10,
    },
    exTitle: { color: colors.text, fontWeight: "900", marginBottom: 8 },

    setRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    setNo: {
      backgroundColor: colors.card,
      color: colors.text,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: "hidden",
      fontWeight: "900",
    },
    setText: { color: colors.text, flexShrink: 1, fontWeight: "700" },

    // Dropset
    badgeDrop: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(239,68,68,0.35)",
      backgroundColor: "rgba(239,68,68,0.10)",
    },
    badgeDropText: { color: "#ef4444", fontWeight: "900", fontSize: 12, letterSpacing: 0.5 },
    dropIndex: { width: 18, color: colors.subtle, fontWeight: "900" },

    // Superset wrap (matches your real UI vibe)
    supersetWrap: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 2,
      padding: 12,
      marginBottom: 10,
      overflow: "hidden",
    },
    supersetRail: { width: 6, borderRadius: 999, marginRight: 10 },

    supersetHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    supersetBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },
    supersetBadgeText: { fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },
    supersetHint: { color: colors.subtle, fontWeight: "800", fontSize: 12 },

    supersetExercise: { borderRadius: 12 },
    supersetDividerTop: {
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
