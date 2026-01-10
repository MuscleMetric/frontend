// app/features/home/ui/modals/StarterTemplatePreviewModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { supabase } from "../../../../../lib/supabase";
import { Button, Card, Pill } from "@/ui";

type Row = {
  id: string;
  order_index: number;
  exercise_name: string;
  target_sets?: number | null;
  target_reps?: number | null;
  target_time_seconds?: number | null;
  notes?: string | null;
  superset_group?: string | null;
  superset_index?: number | null;
};

function fmtTime(sec?: number | null) {
  if (!sec || sec <= 0) return null;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h} hr` : `${h} hr ${mm} min`;
}

function fmtTargets(r: Row) {
  const parts: string[] = [];
  if (r.target_sets != null) parts.push(`${r.target_sets} sets`);
  if (r.target_reps != null) parts.push(`${r.target_reps} reps`);
  const t = fmtTime(r.target_time_seconds);
  if (t) parts.push(t);
  return parts.join(" · ");
}

export function StarterTemplatePreviewModal({
  visible,
  templateWorkoutId,
  title,
  onClose,
}: {
  visible: boolean;
  templateWorkoutId: string | null;
  title?: string;
  onClose: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (!templateWorkoutId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("workout_exercises")
          .select(
            `
            id,
            order_index,
            target_sets,
            target_reps,
            target_time_seconds,
            notes,
            superset_group,
            superset_index,
            exercises:exercises(name)
          `
          )
          .eq("workout_id", templateWorkoutId)
          .eq("is_archived", false)
          .order("order_index", { ascending: true });

        if (cancelled) return;

        if (error) throw error;

        const mapped: Row[] =
          (data ?? []).map((x: any) => ({
            id: String(x.id),
            order_index: Number(x.order_index ?? 0),
            exercise_name: String(x?.exercises?.name ?? "Exercise"),
            target_sets: x.target_sets != null ? Number(x.target_sets) : null,
            target_reps: x.target_reps != null ? Number(x.target_reps) : null,
            target_time_seconds: x.target_time_seconds != null ? Number(x.target_time_seconds) : null,
            notes: x.notes != null ? String(x.notes) : null,
            superset_group: x.superset_group != null ? String(x.superset_group) : null,
            superset_index: x.superset_index != null ? Number(x.superset_index) : null,
          })) ?? [];

        setRows(mapped);
      } catch (e: any) {
        setError(e?.message ? String(e.message) : "Failed to load template");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, templateWorkoutId]);

  async function onStartNow() {
    if (!templateWorkoutId) return;
    if (starting) return;

    setStarting(true);
    setError(null);
    try {
      // ✅ your RPC (adjust name if yours differs)
      const { data, error } = await supabase.rpc("clone_starter_template", {
        p_template_workout_id: templateWorkoutId,
      });

      if (error) throw error;

      const workoutId = typeof data === "string" ? data : String(data);

      // ✅ route to workouts tab; pass workoutId so tab can optionally deep-link
      // (If your workouts tab ignores params, this still works — user lands in library.)
      router.push({
        pathname: "/(tabs)/workout",
        params: { workoutId, start: "1" },
      });

      onClose();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Couldn’t start workout");
    } finally {
      setStarting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [pressed ? { opacity: 0.7 } : null]}>
            <Text style={styles.close}>Close</Text>
          </Pressable>

          <View style={{ flex: 1 }} />

          <Pill label="STARTER" tone="primary" />
        </View>

        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {title || "Starter workout"}
          </Text>
          <Text style={styles.sub} numberOfLines={2}>
            Preview the session. Tap Start now to add it to your library and begin.
          </Text>
        </View>

        <Card style={styles.bodyCard}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading exercises…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(r) => r.id}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => {
                const targets = fmtTargets(item);

                return (
                  <View style={{ gap: 4 }}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {item.order_index + 1}. {item.exercise_name}
                    </Text>

                    {!!targets ? (
                      <Text style={styles.targets} numberOfLines={1}>
                        {targets}
                      </Text>
                    ) : null}

                    {!!item.notes ? (
                      <Text style={styles.note} numberOfLines={2}>
                        {item.notes}
                      </Text>
                    ) : null}
                  </View>
                );
              }}
            />
          )}
        </Card>

        <View style={styles.footer}>
          <Button
            title={starting ? "Starting…" : "Start now"}
            onPress={onStartNow}
            variant="primary"
            fullWidth
            disabled={loading || !!error || starting}
          />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: layout.space.lg,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: layout.space.lg,
      gap: layout.space.md,
    },
    close: {
      fontFamily: typography.fontFamily.semibold,
      color: colors.primary,
      fontSize: typography.size.sub,
    },
    header: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.lg,
      paddingBottom: layout.space.md,
      gap: 6,
    },
    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h1,
      lineHeight: typography.lineHeight.h1,
      color: colors.text,
      letterSpacing: -0.6,
    },
    sub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      color: colors.textMuted,
    },
    bodyCard: {
      flex: 1,
      marginHorizontal: layout.space.lg,
      marginTop: layout.space.md,
      borderRadius: layout.radius.xl,
      padding: layout.space.lg,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
    },
    muted: {
      fontFamily: typography.fontFamily.medium,
      color: colors.textMuted,
      fontSize: typography.size.sub,
    },
    error: {
      fontFamily: typography.fontFamily.semibold,
      color: colors.danger ?? colors.text,
      fontSize: typography.size.sub,
      textAlign: "center",
    },
    sep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 12,
      opacity: 0.9,
    },
    exerciseName: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      color: colors.text,
    },
    targets: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },
    note: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      color: colors.textMuted,
    },
    footer: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.md,
      paddingBottom: layout.space.lg,
      backgroundColor: colors.bg,
    },
  });
