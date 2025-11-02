// app/features/history/detail.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Share,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/useAuth";
import { useAppTheme } from "../../../../lib/useAppTheme";

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

  useEffect(() => {
    if (!userId || !id) return;
    (async () => {
      setLoading(true);
      try {
        // 1) Load workout header
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

        // 2) Load detailed set list (groupable by exercise)
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
          .in(
            "workout_exercise_history.workout_history_id",
            [header.id] // filter through the parent relation
          )
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

  const grouped = useMemo(() => {
    // group sets by exercise name in order_index order
    const map = new Map<
      string,
      { name: string; type: string | null; sets: SetRow[]; order: number }
    >();
    for (const r of sets) {
      const ex = r.workout_exercise_history.exercises;
      const key = ex.id;
      if (!map.has(key)) {
        map.set(key, {
          name: ex.name,
          type: ex.type,
          sets: [],
          order: r.workout_exercise_history.order_index ?? 0,
        });
      }
      map.get(key)!.sets.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
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

  async function onShare() {
    if (!wh) return;
    setSharing(true);
    try {
      const title = wh.workouts?.title ?? "Workout";
      const when = fmtDateTime(wh.completed_at);
      const lines: string[] = [];
      lines.push(`${title} — ${when}`);
      if (wh.duration_seconds)
        lines.push(`Duration: ${fmtDuration(wh.duration_seconds)}`);
      if (wh.notes) lines.push(`Notes: ${wh.notes}`);
      lines.push("");

      for (const g of grouped) {
        lines.push(`• ${g.name}${g.type ? ` (${g.type})` : ""}`);
        for (const s of g.sets) {
          lines.push(`   Set ${s.set_number}: ${fmtSetLine(s)}`);
        }
        lines.push("");
      }

      const message = lines.join("\n");
      await Share.share({
        title,
        message,
      });
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? "Could not share workout.");
    } finally {
      setSharing(false);
    }
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
      edges={["top", "left", "right"]} // keep bottom free for share sheets/home indicator
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        {/* Header card */}
        <View style={s.card}>
          <View
            style={[
              {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              },
            ]}
          >
            <Text style={s.h2}>{title}</Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{ paddingVertical: 6, paddingHorizontal: 10 }}
            >
              <Text style={[s.link]}>Close</Text>
            </Pressable>
          </View>
          <Text style={s.muted}>{fmtDateTime(wh.completed_at)}</Text>
          <View style={{ height: 8 }} />
          <View style={[{ flexDirection: "row", gap: 12 }]}>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Duration</Text>
              <Text style={s.kpiValue}>{fmtDuration(wh.duration_seconds)}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Exercises</Text>
              <Text style={s.kpiValue}>{grouped.length}</Text>
            </View>
            <View style={s.kpi}>
              <Text style={s.kpiLabel}>Total Sets</Text>
              <Text style={s.kpiValue}>{sets.length}</Text>
            </View>
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
            <Text style={s.btnPrimaryText}>
              {sharing ? "Preparing…" : "Share workout"}
            </Text>
          </Pressable>
        </View>

        {/* Exercises & sets */}
        <View style={s.card}>
          <Text style={s.h3}>Details</Text>
          <View style={{ height: 8 }} />
          {grouped.map((g, idx) => (
            <View key={`${g.name}-${idx}`} style={s.exBlock}>
              <Text style={s.exTitle}>
                {g.name}{" "}
                <Text style={s.muted}>{g.type ? `· ${g.type}` : ""}</Text>
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
    },
    h2: { fontSize: 20, fontWeight: "800", color: colors.text },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    subhead: {
      color: colors.text,
      fontWeight: "700",
      marginTop: 6,
      marginBottom: 4,
    },
    notes: { color: colors.subtle },
    link: { color: colors.primary, fontWeight: "700" },
    kpi: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    kpiLabel: { color: colors.subtle, fontSize: 12, marginBottom: 4 },
    kpiValue: { color: colors.text, fontWeight: "800", fontSize: 18 },
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
    muted: { color: colors.subtle },
  });
