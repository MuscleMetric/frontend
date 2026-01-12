// app/features/history/detail.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { ShareWorkoutCard } from "./shareWorkoutCard";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { getVolumeComparison } from "../../../utils/animalVolumeComparison";
import { getDistanceComparison } from "../../../utils/cardioDistanceComparison";

type WorkoutHistoryRow = {
  id: string;
  user_id: string;
  completed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  workouts: { id: string; title: string | null } | null;
};

type SetRow = {
  id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  time_seconds: number | null;
  distance: number | null;
  notes: string | null;
  workout_exercise_history: {
    id: string;
    order_index: number;
    superset_group: string | null;
    superset_index: number | null;
    is_dropset: boolean | null;
    exercises: { id: string; name: string; type: string | null };
  };
};

function volOfSet(s: SetRow) {
  const reps = Number(s.reps ?? 0);
  const wt = Number(s.weight ?? 0);
  return reps * wt;
}

function fmtInt(n: number | null | undefined) {
  const v = Math.max(0, Math.round(n ?? 0));
  return v.toLocaleString();
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

const VARIANTS: ("pattern" | "transparent")[] = ["pattern", "transparent"];

type Block =
  | {
      kind: "single";
      wehId: string;
      name: string;
      type: string | null;
      sets: SetRow[];
      order: number;
      volume: number;
      totalDistance: number;
    }
  | {
      kind: "superset";
      groupId: string;
      order: number;
      items: Array<{
        wehId: string;
        name: string;
        type: string | null;
        supersetIndex: number;
        sets: SetRow[];
        volume: number;
        totalDistance: number;
      }>;
    };

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [wh, setWh] = useState<WorkoutHistoryRow | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [sharing, setSharing] = useState(false);

  const [weeklyStreak, setWeeklyStreak] = useState<number | null>(null);

  // modal + share state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0); // which variant slide
  const [shareMode, setShareMode] = useState<"stats" | "full">("stats");
  const cardRefs = useRef<(View | null)[]>([]); // one ref per variant slide

  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("weekly_streak")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data && typeof data.weekly_streak === "number") {
          setWeeklyStreak(data.weekly_streak);
        } else {
          setWeeklyStreak(0);
        }
      } catch (e) {
        console.warn("load weekly_streak error", e);
        setWeeklyStreak(0);
      }
    })();
  }, [userId]);

  const totalVolume = useMemo(
    () =>
      sets.reduce((sum, s) => {
        const w = s.weight ?? 0;
        const r = s.reps ?? 0;
        return sum + w * r;
      }, 0),
    [sets]
  );

  const totalDistance = useMemo(
    () =>
      sets.reduce((sum, s) => {
        const d = s.distance ?? 0;
        return sum + d;
      }, 0),
    [sets]
  );

  const hasWeight = useMemo(
    () => sets.some((s) => s.weight != null && s.reps != null),
    [sets]
  );

  const hasDistance = useMemo(
    () => sets.some((s) => s.distance != null),
    [sets]
  );

  useEffect(() => {
    if (!userId || !id) return;
    (async () => {
      setLoading(true);
      try {
        const { data: header, error: e1 } = await supabase
          .from("workout_history")
          .select(
            `
              id, user_id, completed_at, duration_seconds, notes,
              workouts:workouts(id, title)
            `
          )
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle<WorkoutHistoryRow>();

        if (e1) throw e1;
        if (!header) {
          Alert.alert("Not found", "This workout could not be loaded.");
          router.back();
          return;
        }
        setWh(header);

        // ✅ include WEH.id + superset + dropset fields so we can render cleanly
        const { data: rows, error: e2 } = await supabase
          .from("workout_set_history")
          .select(
            `
              id,
              set_number, reps, weight, time_seconds, distance, notes,
              workout_exercise_history:workout_exercise_history!inner(
                id,
                order_index,
                superset_group,
                superset_index,
                is_dropset,
                exercises:exercises!inner(id, name, type)
              )
            `
          )
          .in("workout_exercise_history.workout_history_id", [header.id])
          .order("order_index", {
            ascending: true,
            referencedTable: "workout_exercise_history",
          })
          .order("superset_index", {
            ascending: true,
            referencedTable: "workout_exercise_history",
          })
          .order("set_number", { ascending: true })
          .returns<SetRow[]>();

        if (e2) throw e2;

        setSets(rows ?? []);
      } catch (err: any) {
        console.error("load workout detail error:", err);
        Alert.alert("Error", err?.message ?? "Failed to load workout.");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, id]);

  // ✅ Build Blocks: singles + superset groups (ordered + stable) and group by WEH.id
  const blocks: Block[] = useMemo(() => {
    const byWeh = new Map<
      string,
      {
        wehId: string;
        name: string;
        type: string | null;
        order: number;
        supersetGroup: string | null;
        supersetIndex: number;
        sets: SetRow[];
        volume: number;
        totalDistance: number;
      }
    >();

    for (const r of sets) {
      const weh = r.workout_exercise_history;
      const ex = weh.exercises;
      const wehId = weh.id;

      if (!byWeh.has(wehId)) {
        byWeh.set(wehId, {
          wehId,
          name: ex.name,
          type: ex.type,
          order: weh.order_index ?? 0,
          supersetGroup: weh.superset_group ?? null,
          supersetIndex: Number(weh.superset_index ?? 0),
          sets: [],
          volume: 0,
          totalDistance: 0,
        });
      }

      const entry = byWeh.get(wehId)!;
      entry.sets.push(r);

      // volume & distance per exercise (for optional display later)
      const vol = volOfSet(r);
      entry.volume += vol;
      entry.totalDistance += Number(r.distance ?? 0);
    }

    const entries = Array.from(byWeh.values()).sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.supersetIndex - b.supersetIndex;
    });

    const ssMap = new Map<string, { order: number; items: typeof entries }>();
    const singles: typeof entries = [];

    for (const e of entries) {
      if (e.supersetGroup) {
        if (!ssMap.has(e.supersetGroup)) {
          ssMap.set(e.supersetGroup, { order: e.order, items: [] as any });
        }
        const g = ssMap.get(e.supersetGroup)!;
        g.items.push(e as any);
        g.order = Math.min(g.order, e.order);
      } else {
        singles.push(e);
      }
    }

    // Superset letter assignment stable by "first appearance order"
    const supersetGroupsSorted = Array.from(ssMap.entries()).sort(
      (a, b) => a[1].order - b[1].order
    );

    const supersetBlocks: Block[] = supersetGroupsSorted.map(
      ([groupId, g]) => ({
        kind: "superset",
        groupId,
        order: g.order,
        items: g.items
          .slice()
          .sort((a, b) => a.supersetIndex - b.supersetIndex)
          .map((it) => ({
            wehId: it.wehId,
            name: it.name,
            type: it.type,
            supersetIndex: it.supersetIndex,
            sets: it.sets,
            volume: it.volume,
            totalDistance: it.totalDistance,
          })),
      })
    );

    const singleBlocks: Block[] = singles.map((it) => ({
      kind: "single",
      wehId: it.wehId,
      name: it.name,
      type: it.type,
      sets: it.sets,
      order: it.order,
      volume: it.volume,
      totalDistance: it.totalDistance,
    }));

    return [...supersetBlocks, ...singleBlocks].sort(
      (a, b) => a.order - b.order
    );
  }, [sets]);

  // Derived counts based on blocks (what user actually sees)
  const exercisesCount = useMemo(() => {
    let n = 0;
    for (const b of blocks) {
      if (b.kind === "single") n += 1;
      else n += b.items.length;
    }
    return n;
  }, [blocks]);

  const workoutVolume = useMemo(
    () => sets.reduce((sum, r) => sum + volOfSet(r), 0),
    [sets]
  );

  const volumeComparison = useMemo(
    () => (hasWeight ? getVolumeComparison(workoutVolume) : null),
    [hasWeight, workoutVolume]
  );

  const distanceComparison = useMemo(
    () => (hasDistance ? getDistanceComparison(totalDistance) : null),
    [hasDistance, totalDistance]
  );

  function fmtDateTime(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  function fmtDuration(sec?: number | null) {
    if (!sec) return "—";
    const m = Math.floor((sec as number) / 60);
    const sLeft = (sec as number) % 60;
    return `${m}m ${sLeft}s`;
  }

  function fmtSetLine(s: SetRow) {
    const parts: string[] = [];
    if (s.weight != null && s.reps != null)
      parts.push(`${s.weight}kg x ${s.reps}`);
    else if (s.reps != null) parts.push(`${s.reps} reps`);
    if (s.time_seconds != null) parts.push(`${s.time_seconds}s`);
    if (s.distance != null) parts.push(`${s.distance}m`);
    if (s.notes) parts.push(`(${s.notes})`);
    return parts.join(" · ");
  }

  // ✅ Dropset-aware renderer: groups rows by set_number, shows "DROPSET" if repeated or flag set
  function renderSetsForExercise(exSets: SetRow[]) {
    const map = new Map<number, SetRow[]>();
    exSets.forEach((st) => {
      const k = Number(st.set_number);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(st);
    });

    const setNums = Array.from(map.keys()).sort((a, b) => a - b);

    return setNums.map((k) => {
      const rows = map.get(k)!;

      const isDrop =
        rows.length > 1 ||
        rows.some((r) => !!r.workout_exercise_history.is_dropset);

      // Keep dropsets stable: if you ever add created_at, sort by it here.
      // For now, fall back to row.id which is stable.
      const stableRows = rows.slice().sort((a, b) => a.id.localeCompare(b.id));

      return (
        <View key={`setgrp-${k}`} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.setNo}>#{k}</Text>

            {isDrop && (
              <View style={s.badgeDrop}>
                <Text style={s.badgeDropText}>DROPSET</Text>
              </View>
            )}
          </View>

          <View style={{ marginTop: 6, marginLeft: 6, gap: 4 }}>
            {stableRows.map((row, i) => (
              <View key={row.id} style={s.setRow}>
                {isDrop ? <Text style={s.dropIndex}>{i + 1}.</Text> : null}
                <Text style={s.setText}>{fmtSetLine(row)}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    });
  }

  // Lines for the "full workout" share image (stats + all sets)
  const fullLines = useMemo(() => {
    if (!wh) return [];

    const title = wh.workouts?.title ?? "Workout";
    const when = fmtDateTime(wh.completed_at);

    const lines: string[] = [];

    // header stats
    lines.push(`${title} — ${when}`);
    if (wh.duration_seconds)
      lines.push(`Duration: ${fmtDuration(wh.duration_seconds)}`);

    lines.push(`Exercises: ${exercisesCount}`);
    lines.push(`Total sets: ${sets.length}`);
    lines.push(`Total volume: ${totalVolume.toFixed(0)} kg`);
    lines.push("");

    // ✅ Supersets + dropsets in text export too
    let ssLetter = 0;

    for (const b of blocks) {
      if (b.kind === "superset") {
        const letter = String.fromCharCode(65 + (ssLetter % 26));
        ssLetter++;

        lines.push(`Superset ${letter}`);
        for (const ex of b.items) {
          lines.push(`  ${ex.name}${ex.type ? ` (${ex.type})` : ""}`);

          // group rows by set_number
          const bySet = new Map<number, SetRow[]>();
          ex.sets.forEach((st) => {
            const k = Number(st.set_number);
            if (!bySet.has(k)) bySet.set(k, []);
            bySet.get(k)!.push(st);
          });

          const nums = Array.from(bySet.keys()).sort((a, b) => a - b);
          for (const num of nums) {
            const rows = (bySet.get(num) ?? [])
              .slice()
              .sort((a, b) => a.id.localeCompare(b.id));
            const isDrop =
              rows.length > 1 ||
              rows.some((r) => !!r.workout_exercise_history.is_dropset);

            if (!isDrop) {
              for (const st of rows)
                lines.push(`    Set ${st.set_number}: ${fmtSetLine(st)}`);
            } else {
              lines.push(`    Set ${num} (DROPSET):`);
              rows.forEach((st, i) =>
                lines.push(`      ${i + 1}. ${fmtSetLine(st)}`)
              );
            }
          }
        }
        lines.push("");
      } else {
        lines.push(`${b.name}${b.type ? ` (${b.type})` : ""}`);

        const bySet = new Map<number, SetRow[]>();
        b.sets.forEach((st) => {
          const k = Number(st.set_number);
          if (!bySet.has(k)) bySet.set(k, []);
          bySet.get(k)!.push(st);
        });

        const nums = Array.from(bySet.keys()).sort((a, b) => a - b);
        for (const num of nums) {
          const rows = (bySet.get(num) ?? [])
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id));
          const isDrop =
            rows.length > 1 ||
            rows.some((r) => !!r.workout_exercise_history.is_dropset);

          if (!isDrop) {
            for (const st of rows)
              lines.push(`  Set ${st.set_number}: ${fmtSetLine(st)}`);
          } else {
            lines.push(`  Set ${num} (DROPSET):`);
            rows.forEach((st, i) =>
              lines.push(`    ${i + 1}. ${fmtSetLine(st)}`)
            );
          }
        }

        lines.push("");
      }
    }

    return lines;
  }, [wh, blocks, sets.length, totalVolume, exercisesCount]);

  const fullText = useMemo(() => fullLines.join("\n"), [fullLines]);

  const CARD_WIDTH = 720;
  const CARD_HEIGHT = 1280;

  // fixed area the preview must fit inside (inside the modal)
  const PREVIEW_BOX_HEIGHT = 350;

  const windowDims = Dimensions.get("window");
  const windowWidth = windowDims.width;

  // leave some padding inside the modal
  const maxPreviewWidth = windowWidth - 80;
  const maxPreviewHeight = PREVIEW_BOX_HEIGHT;

  const previewScale = Math.min(
    maxPreviewWidth / CARD_WIDTH,
    maxPreviewHeight / CARD_HEIGHT,
    1
  );

  async function shareCurrentCard() {
    const ref = cardRefs.current[currentIndex];
    if (!ref) return;
    try {
      setSharing(true);
      const uri = await captureRef(ref, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri);
    } finally {
      setSharing(false);
      setPreviewVisible(false);
    }
  }

  function onShare() {
    setPreviewVisible(true);
  }

  if (!userId) {
    return (
      <View style={[s.center]}>
        <Text style={s.muted}>Sign in to view this workout.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!wh) {
    return (
      <View style={[s.center]}>
        <Text style={s.muted}>Workout not found.</Text>
      </View>
    );
  }

  const title = wh.workouts?.title ?? "Workout";

  function supersetColorFor(groupId: string) {
    // stable color per group id
    const palette = [
      colors.primary,
      "#22c55e",
      "#a855f7", // purple
      "#f59e0b", // amber
      "#ef4444", // red
      "#06b6d4", // cyan
    ];

    let hash = 0;
    for (let i = 0; i < groupId.length; i++)
      hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        <View style={{ marginBottom: 4 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 16,
                fontWeight: "700",
                marginRight: 4,
              }}
            >
              ←
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              Back
            </Text>
          </Pressable>
        </View>

        {/* Header card */}
        <View style={s.card}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={s.h2}>{title}</Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{ paddingVertical: 6, paddingHorizontal: 10 }}
            >
              <Text style={s.link}>Close</Text>
            </Pressable>
          </View>

          <Text style={s.muted}>{fmtDateTime(wh.completed_at)}</Text>
          <View style={{ height: 8 }} />

          <View style={s.kpiWrap}>
            <Kpi
              colors={colors}
              label="Duration"
              value={fmtDuration(wh.duration_seconds)}
            />
            <Kpi
              colors={colors}
              label="Exercises"
              value={String(exercisesCount)}
            />
            <Kpi
              colors={colors}
              label="Total Sets"
              value={fmtInt(sets.length)}
            />

            {hasWeight && (
              <Kpi
                colors={colors}
                label="Total Volume"
                value={fmtInt(workoutVolume)}
                unit="kg"
              />
            )}

            {hasDistance && (
              <Kpi
                colors={colors}
                label="Total Distance"
                value={fmtInt(totalDistance)}
                unit="m"
              />
            )}
          </View>

          {(volumeComparison || distanceComparison) && (
            <View style={{ marginTop: 8 }}>
              {volumeComparison && (
                <Text style={s.comparison}>
                  Roughly the weight of {volumeComparison}.
                </Text>
              )}
              {distanceComparison && (
                <Text style={s.comparison}>
                  Roughly the height of {distanceComparison.label}.
                </Text>
              )}
            </View>
          )}

          {wh.notes ? (
            <>
              <View style={s.hr} />
              <Text style={s.subhead}>Workout Notes</Text>
              <Text style={s.notes}>{wh.notes}</Text>
            </>
          ) : null}

          <View style={{ height: 10 }} />
          <Pressable
            onPress={onShare}
            disabled={sharing}
            style={[
              s.btn,
              s.primary,
              { alignSelf: "flex-start", opacity: sharing ? 0.7 : 1 },
            ]}
          >
            <Text style={s.btnPrimaryText}>
              {sharing ? "Preparing…" : "Share workout"}
            </Text>
          </Pressable>
        </View>

        {/* Share preview modal */}
        <Modal visible={previewVisible} animationType="slide" transparent>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.75)",
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 16,
            }}
          >
            <SafeAreaView
              style={{
                width: "100%",
                maxHeight: "90%",
                backgroundColor: colors.background,
                borderRadius: 16,
                paddingBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                Share workout
              </Text>

              {/* Mode toggle */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <Pressable
                  onPress={() => setShareMode("stats")}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    backgroundColor:
                      shareMode === "stats" ? colors.primary : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: shareMode === "stats" ? "#fff" : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    Stats only
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShareMode("full")}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    backgroundColor:
                      shareMode === "full" ? colors.primary : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: shareMode === "full" ? "#fff" : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    Full workout
                  </Text>
                </Pressable>
              </View>

              {/* Preview */}
              <View style={{ marginTop: 16, alignItems: "center" }}>
                <View
                  style={{
                    height: PREVIEW_BOX_HEIGHT,
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      height: PREVIEW_BOX_HEIGHT,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMomentumScrollEnd={(e) => {
                      const index = Math.round(
                        e.nativeEvent.contentOffset.x /
                          e.nativeEvent.layoutMeasurement.width
                      );
                      setCurrentIndex(index);
                    }}
                  >
                    {VARIANTS.map((v, i) => {
                      const isTransparent = v === "transparent";

                      return (
                        <View
                          key={v}
                          style={{
                            width: windowWidth - 80,
                            height: PREVIEW_BOX_HEIGHT,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={{
                              width: CARD_WIDTH,
                              height: CARD_HEIGHT,
                              transform: [{ scale: previewScale }],
                              borderRadius: 10,
                              overflow: "hidden",
                              justifyContent: "center",
                              alignItems: "center",
                              backgroundColor: isTransparent
                                ? "#000"
                                : "transparent",
                            }}
                          >
                            <ShareWorkoutCard
                              ref={(el) => {
                                cardRefs.current[i] = el;
                              }}
                              colors={colors}
                              title={title}
                              dateLabel={fmtDateTime(wh.completed_at)}
                              durationLabel={fmtDuration(wh.duration_seconds)}
                              exercisesCount={exercisesCount}
                              setsCount={sets.length}
                              totalVolumeKg={
                                hasWeight ? Math.round(totalVolume) : undefined
                              }
                              totalDistanceM={
                                hasDistance
                                  ? Math.round(totalDistance)
                                  : undefined
                              }
                              weeklyStreak={weeklyStreak ?? undefined}
                              mode={shareMode}
                              fullText={fullText}
                              variant={v}
                            />

                            {isTransparent && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: 16,
                                  right: 16,
                                  paddingHorizontal: 14,
                                  paddingVertical: 6,
                                  borderRadius: 999,
                                  borderWidth: StyleSheet.hairlineWidth,
                                  borderColor: "rgba(255,255,255,0.7)",
                                  backgroundColor: "rgba(0,0,0,0.7)",
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#FFFFFF",
                                    fontSize: 35,
                                    fontWeight: "800",
                                    letterSpacing: 2,
                                  }}
                                >
                                  TRANSPARENT
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* dots */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    marginTop: 8,
                    gap: 6,
                  }}
                >
                  {VARIANTS.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          i === currentIndex ? colors.primary : colors.border,
                      }}
                    />
                  ))}
                </View>
              </View>

              {/* Bottom buttons */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  marginTop: 12,
                  gap: 12,
                }}
              >
                <Pressable
                  onPress={() => setPreviewVisible(false)}
                  style={[s.btn, { flex: 1, backgroundColor: colors.surface }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Close
                  </Text>
                </Pressable>
                <Pressable
                  onPress={shareCurrentCard}
                  disabled={sharing}
                  style={[
                    s.btn,
                    s.primary,
                    { flex: 1, opacity: sharing ? 0.7 : 1 },
                  ]}
                >
                  <Text style={s.btnPrimaryText}>
                    {sharing ? "Preparing…" : "Share"}
                  </Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Details */}
        <View style={s.card}>
          <Text style={s.h3}>Details</Text>
          <View style={{ height: 8 }} />

          {(() => {
            let ssLetter = 0;

            return blocks.map((b) => {
              if (b.kind === "superset") {
                const letter = String.fromCharCode(65 + (ssLetter % 26));
                ssLetter++;

                const ssColor = supersetColorFor(b.groupId);

                return (
                  <View
                    key={`ss-${b.groupId}`}
                    style={[
                      s.supersetWrap,
                      {
                        borderColor: ssColor,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    {/* left rail */}
                    <View
                      style={[s.supersetRail, { backgroundColor: ssColor }]}
                    />

                    <View style={{ flex: 1 }}>
                      {/* header */}
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
                          <Text
                            style={[s.supersetBadgeText, { color: ssColor }]}
                          >
                            SUPERSET {letter}
                          </Text>
                        </View>
                      </View>

                      {/* exercises inside the wrap */}
                      <View style={{ gap: 12 }}>
                        {b.items.map((ex, i) => (
                          <View
                            key={ex.wehId}
                            style={[
                              s.supersetExercise,
                              i > 0 ? s.supersetDividerTop : null,
                            ]}
                          >
                            <Text style={s.exTitle}>
                              {ex.name}{" "}
                              <Text style={s.muted}>
                                {ex.type ? `· ${ex.type}` : ""}
                              </Text>
                            </Text>

                            {renderSetsForExercise(ex.sets)}
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View key={b.wehId} style={s.exBlock}>
                  <Text style={s.exTitle}>
                    {b.name}{" "}
                    <Text style={s.muted}>{b.type ? `· ${b.type}` : ""}</Text>
                  </Text>

                  {renderSetsForExercise(b.sets)}
                </View>
              );
            });
          })()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
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
    kpiWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 8,
    },
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
    kpiLabel: { color: colors.subtle, fontSize: 13, marginBottom: 6 },
    kpiNumber: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 22,
      lineHeight: 26,
    },
    kpiUnit: { color: colors.subtle, fontWeight: "800", fontSize: 14 },
    h2: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 2,
    },
    muted: { color: colors.subtle },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    subhead: {
      color: colors.text,
      fontWeight: "700",
      marginTop: 6,
      marginBottom: 4,
    },
    notes: { color: colors.subtle },
    link: { color: colors.primary, fontWeight: "700" },
    hr: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

    // Details
    exBlock: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 10,
    },
    exTitle: { color: colors.text, fontWeight: "800", marginBottom: 8 },

    supersetHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    supersetTitle: {
      color: colors.primary,
      fontWeight: "900",
      fontSize: 14,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    supersetHint: {
      color: colors.subtle,
      fontWeight: "700",
      fontSize: 12,
    },

    setRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    setNo: {
      backgroundColor: colors.card,
      color: colors.text,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: "hidden",
      fontWeight: "800",
    },
    setText: { color: colors.text, flexShrink: 1 },

    // Dropset badge + numbering
    badgeDrop: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(239,68,68,0.35)",
      backgroundColor: "rgba(239,68,68,0.10)",
    },
    badgeDropText: {
      color: "#ef4444",
      fontWeight: "900",
      fontSize: 12,
      letterSpacing: 0.5,
    },
    dropIndex: {
      width: 18,
      color: colors.subtle,
      fontWeight: "800",
    },

    // Buttons
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
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "800" },

    comparison: {
      color: colors.subtle,
      fontSize: 12,
      marginTop: 2,
    },

    supersetWrap: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 2,
      padding: 12,
      marginBottom: 10,
      overflow: "hidden",
    },
    supersetRail: {
      width: 6,
      borderRadius: 999,
      marginRight: 10,
    },
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
    supersetBadgeText: {
      fontWeight: "900",
      fontSize: 12,
      letterSpacing: 0.6,
    },
    supersetExercise: {
      borderRadius: 12,
    },
    supersetDividerTop: {
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(255,255,255,0.10)", // works ok in dark; if light mode looks weird, swap to colors.border
    },
  });
