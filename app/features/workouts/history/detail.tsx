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
import { useAuth } from "../../../../lib/useAuth";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { ShareWorkoutCard } from "./shareWorkoutCard";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

type WorkoutHistoryRow = {
  id: string;
  user_id: string;
  completed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  workouts: { id: string; title: string | null } | null;
};

type SetRow = {
  set_number: number;
  reps: number | null;
  weight: number | null;
  time_seconds: number | null;
  distance: number | null;
  notes: string | null;
  workout_exercise_history: {
    order_index: number;
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

  // modal + share state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0); // which variant slide
  const [shareMode, setShareMode] = useState<"stats" | "full">("stats");
  const cardRefs = useRef<(View | null)[]>([]); // one ref per variant slide

  const totalVolume = useMemo(
    () =>
      sets.reduce((sum, s) => {
        const w = s.weight ?? 0;
        const r = s.reps ?? 0;
        return sum + w * r;
      }, 0),
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

        const { data: rows, error: e2 } = await supabase
          .from("workout_set_history")
          .select(
            `
            set_number, reps, weight, time_seconds, distance, notes,
            workout_exercise_history:workout_exercise_history!inner(
              order_index,
              exercises:exercises!inner(id, name, type)
            )
          `
          )
          .in("workout_exercise_history.workout_history_id", [header.id])
          .order("order_index", {
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

  const { grouped, workoutVolume } = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        type: string | null;
        sets: SetRow[];
        order: number;
        volume: number;
      }
    >();

    let total = 0;

    for (const r of sets) {
      const ex = r.workout_exercise_history.exercises;
      const key = ex.id;

      if (!map.has(key)) {
        map.set(key, {
          name: ex.name,
          type: ex.type,
          sets: [],
          order: r.workout_exercise_history.order_index ?? 0,
          volume: 0,
        });
      }

      const vol = volOfSet(r);
      total += vol;

      const entry = map.get(key)!;
      entry.sets.push(r);
      entry.volume += vol;
    }

    const arr = Array.from(map.values()).sort((a, b) => a.order - b.order);
    return { grouped: arr, workoutVolume: total };
  }, [sets]);

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

  // Build "full workout" text once for the card
  const fullSummary = useMemo(() => {
    if (!wh) return "";
    const title = wh.workouts?.title ?? "Workout";
    const when = fmtDateTime(wh.completed_at);
    const lines: string[] = [];

    lines.push(`${title} — ${when}`);
    if (wh.duration_seconds)
      lines.push(`Duration: ${fmtDuration(wh.duration_seconds)}`);
    lines.push(`Exercises: ${grouped.length}`);
    lines.push(`Total sets: ${sets.length}`);
    lines.push(`Total volume: ${totalVolume.toFixed(0)} kg`);
    lines.push("");

    for (const g of grouped) {
      lines.push(`${g.name}${g.type ? ` (${g.type})` : ""}`);
      for (const s of g.sets) {
        lines.push(`  Set ${s.set_number}: ${fmtSetLine(s)}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }, [wh, grouped, sets, totalVolume]);

  // Lines for the "full workout" share image (stats + all sets)
  const fullLines = useMemo(() => {
    if (!wh) return [];

    const title = wh.workouts?.title ?? "Workout";
    const when = fmtDateTime(wh.completed_at);

    const lines: string[] = [];

    // header stats
    lines.push(`${title} — ${when}`);
    if (wh.duration_seconds) {
      lines.push(`Duration: ${fmtDuration(wh.duration_seconds)}`);
    }
    lines.push(`Exercises: ${grouped.length}`);
    lines.push(`Total sets: ${sets.length}`);
    lines.push(`Total volume: ${totalVolume.toFixed(0)} kg`);

    // GAP between stats and first exercise
    lines.push("");

    // exercises + sets
    for (const g of grouped) {
      lines.push(`${g.name}${g.type ? ` (${g.type})` : ""}`);
      for (const s of g.sets) {
        lines.push(`  Set ${s.set_number}: ${fmtSetLine(s)}`);
      }
      lines.push(""); // gap between exercises
    }

    return lines;
  }, [wh, grouped, sets, totalVolume]);

  const fullText = useMemo(() => fullLines.join("\n"), [fullLines]);

  const CARD_WIDTH = 720;
  const CARD_HEIGHT = 1280;

  const windowDims = Dimensions.get("window");
  const windowWidth = windowDims.width;
  const windowHeight = windowDims.height;

  // leave some padding inside the modal
  const maxPreviewWidth = windowWidth - 64;
  const maxPreviewHeight = windowHeight * 0.6;

  // scale the card down so it fits
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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
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
              value={String(grouped.length)}
            />
            <Kpi
              colors={colors}
              label="Total Sets"
              value={fmtInt(sets.length)}
            />
            <Kpi
              colors={colors}
              label="Total Volume"
              value={fmtInt(workoutVolume)}
              unit="kg"
            />
          </View>

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
            <Text style={s.btnPrimaryText}>Share workout</Text>
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

              {/* Mode toggle: stats vs full */}
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

              {/* Swipeable pattern / transparent */}
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 16 }}
                contentContainerStyle={{ alignItems: "center" }}
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
                        width: windowWidth,
                        alignItems: "center",
                        paddingVertical: 12,
                      }}
                    >
                      {/* Preview wrapper – this is NOT what we capture */}
                      <View
                        style={{
                          width: CARD_WIDTH,
                          height: CARD_HEIGHT,
                          transform: [{ scale: previewScale }],
                          backgroundColor: isTransparent
                            ? "#000"
                            : "transparent",
                          borderRadius: 40,
                          overflow: "hidden",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        {/* Actual card we capture */}
                        <ShareWorkoutCard
                          ref={(el) => {
                            cardRefs.current[i] = el;
                          }}
                          colors={colors}
                          title={title}
                          dateLabel={fmtDateTime(wh.completed_at)}
                          durationLabel={fmtDuration(wh.duration_seconds)}
                          exercisesCount={grouped.length}
                          setsCount={sets.length}
                          totalVolumeKg={Math.round(totalVolume)}
                          mode={shareMode} // "stats" | "full"
                          fullText={fullText} // used in "full" mode
                          variant={v}
                        />

                        {/* Transparent indicator – only visible in preview */}
                        {isTransparent && (
                          <View
                            style={{
                              position: "absolute",
                              top: 12,
                              right: 12,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 999,
                              borderWidth: StyleSheet.hairlineWidth,
                              borderColor: "rgba(255,255,255,0.5)",
                              backgroundColor: "rgba(0,0,0,0.65)",
                            }}
                          >
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 11,
                                fontWeight: "700",
                                letterSpacing: 1,
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

              {/* dots indicator */}
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

              {/* Bottom buttons */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  marginTop: 16,
                  gap: 12,
                }}
              >
                <Pressable
                  onPress={() => setPreviewVisible(false)}
                  style={[
                    s.btn,
                    {
                      flex: 1,
                      backgroundColor: colors.surface,
                    },
                  ]}
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
                    {
                      flex: 1,
                      opacity: sharing ? 0.7 : 1,
                    },
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

        {/* Exercises & sets list */}
        <View style={s.card}>
          <Text style={s.h3}>Details</Text>
          <View style={{ height: 8 }} />
          {grouped.map((g, idx) => (
            <View key={`${g.name}-${idx}`} style={s.exBlock}>
              <Text style={s.exTitle}>
                {g.name}{" "}
                <Text style={s.muted}>{g.type ? `· ${g.type}` : ""}</Text>
              </Text>

              <Text style={[s.muted, { marginBottom: 6 }]}>
                Volume:{" "}
                <Text style={{ fontWeight: "800", color: colors.text }}>
                  {fmtInt(g.volume)}kg
                </Text>
              </Text>

              {g.sets.map((row) => (
                <View key={row.set_number} style={s.setRow}>
                  <Text style={s.setNo}>#{row.set_number}</Text>
                  <Text style={s.setText}>{fmtSetLine(row)}</Text>
                </View>
              ))}
            </View>
          ))}
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
    exBlock: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 10,
    },
    exTitle: { color: colors.text, fontWeight: "800", marginBottom: 8 },
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
    setText: { color: colors.text },
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
  });
