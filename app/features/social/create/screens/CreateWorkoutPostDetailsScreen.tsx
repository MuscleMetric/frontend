import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

type WorkoutDetailsRow = {
  id: string; // workout_history.id
  completed_at: string | null;
  duration_seconds: number | null;
  workout_id: string | null;
  workouts?: { id: string; title: string | null; workout_image_key: string | null } | Array<{
    id: string;
    title: string | null;
    workout_image_key: string | null;
  }> | null;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(seconds: number | null) {
  const s = Number(seconds ?? 0);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function normalizeWorkoutJoin(row: WorkoutDetailsRow) {
  const j = (row as any).workouts;
  if (!j) return null;
  return Array.isArray(j) ? j[0] : j;
}

export default function CreateWorkoutPostDetailsScreen() {
  const { colors, typography, layout } = useAppTheme();
  const params = useLocalSearchParams<{ workout_history_id?: string }>();
  const workoutHistoryId = params.workout_history_id ? String(params.workout_history_id) : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.bg, padding: layout.space.lg, gap: layout.space.md },
        title: { color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.h1 },
        sub: { color: colors.textMuted, fontFamily: typography.fontFamily.regular, fontSize: typography.size.sub },

        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          gap: layout.space.md,
        },

        kvRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
        k: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.meta },
        v: { color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.meta, flex: 1, textAlign: "right" },

        pillRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
        pill: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        pillOn: { backgroundColor: colors.cardPressed, borderColor: colors.primary },
        pillText: { color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.meta },

        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          padding: 12,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          minHeight: 96,
        },

        btn: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
          marginTop: 6,
        },
        btnText: { color: colors.onPrimary, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },

        ghost: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        ghostText: { color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },

        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        error: { color: colors.danger, fontFamily: typography.fontFamily.medium, fontSize: typography.size.body, textAlign: "center" },
      }),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [workoutTitle, setWorkoutTitle] = useState<string>("Workout");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [caption, setCaption] = useState("Just finished a session. Consistency > motivation. 💪");

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      if (!workoutHistoryId) throw new Error("Missing workout_history_id");

      const { data, error } = await supabase
        .from("workout_history")
        .select(
          `
          id,
          completed_at,
          duration_seconds,
          workout_id,
          workouts:workouts (
            id,
            title,
            workout_image_key
          )
        `
        )
        .eq("id", workoutHistoryId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Workout not found");

      const row = data as unknown as WorkoutDetailsRow;
      const w = normalizeWorkoutJoin(row);

      setWorkoutTitle(w?.title ?? "Workout");
      setCompletedAt(row.completed_at ?? null);
      setDurationSeconds((row as any).duration_seconds ?? null);

      // optional: prefill caption using title
      setCaption((prev) => (prev?.trim() ? prev : `Just finished ${w?.title ?? "a workout"} 💪`));
    } catch (e: any) {
      console.log("details load error:", e);
      setErrorMsg(e?.message ?? "Failed to load workout");
    } finally {
      setLoading(false);
    }
  }, [workoutHistoryId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const goReview = () => {
    const draft = {
      post_type: "workout",
      visibility,
      caption: caption.trim(),
      workout_history_id: workoutHistoryId,
      exercise_id: null,
      pr_snapshot: null,
    };

    router.push({
      pathname: "/features/social/create/review",
      params: { draft: JSON.stringify(draft) },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <Text style={styles.title}>Post details</Text>
        <Text style={styles.sub}>Confirm the workout, then add a caption.</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : errorMsg ? (
          <View style={styles.center}>
            <Text style={styles.error}>{errorMsg}</Text>
            <Pressable style={[styles.ghost, { marginTop: 12 }]} onPress={() => router.back()}>
              <Text style={styles.ghostText}>Back</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.kvRow}>
              <Text style={styles.k}>Workout</Text>
              <Text style={styles.v} numberOfLines={1}>{workoutTitle}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>Completed</Text>
              <Text style={styles.v} numberOfLines={1}>{fmtDateTime(completedAt)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>Duration</Text>
              <Text style={styles.v}>{fmtDuration(durationSeconds)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>workout_history_id</Text>
              <Text style={styles.v} numberOfLines={1}>{workoutHistoryId ?? "—"}</Text>
            </View>

            <Text style={[styles.sub, { marginTop: 6 }]}>Visibility</Text>
            <View style={styles.pillRow}>
              {(["public", "followers", "private"] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setVisibility(v)}
                  style={[styles.pill, visibility === v && styles.pillOn]}
                >
                  <Text style={styles.pillText}>{v}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sub, { marginTop: 6 }]}>Caption</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Write something…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
            />

            <Pressable style={styles.btn} onPress={goReview}>
              <Text style={styles.btnText}>Review</Text>
            </Pressable>

            <Pressable style={styles.ghost} onPress={() => router.back()}>
              <Text style={styles.ghostText}>Back</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}