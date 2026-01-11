// app/features/home/ui/modals/StarterTemplatePreviewModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  ImageBackground,
} from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { supabase } from "../../../../../lib/supabase";
import { Button, Card, Pill } from "@/ui";
import { resolveFullWorkoutImage } from "@/ui/media/fullWorkoutImages";

type Row = {
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

function groupKey(r: Row) {
  return r.superset_group ? String(r.superset_group) : null;
}

export function StarterTemplatePreviewModal({
  visible,
  templateWorkoutId,
  title,
  onClose,
  imageKey, // ✅ pass template_key or workoutImageKey from the tile
  badgeLabel = "STARTER",
}: {
  visible: boolean;
  templateWorkoutId: string | null;
  title?: string;
  onClose: () => void;
  imageKey?: string | null;
  badgeLabel?: string;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  // ✅ derive a nice image key fallback
  const headerImage = useMemo(() => {
    return resolveFullWorkoutImage(imageKey ?? "full_body");
  }, [imageKey]);

  useEffect(() => {
    if (!visible) return;
    if (!templateWorkoutId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // ✅ Use RPC so RLS doesn't hide template exercises
        const { data, error } = await supabase.rpc("get_starter_template_preview", {
          p_template_workout_id: templateWorkoutId,
        });

        if (cancelled) return;
        if (error) throw error;

        const mapped: Row[] = (data ?? []).map((x: any) => ({
          order_index: Number(x.order_index ?? 0),
          exercise_name: String(x.exercise_name ?? "Exercise"),
          target_sets: x.target_sets != null ? Number(x.target_sets) : null,
          target_reps: x.target_reps != null ? Number(x.target_reps) : null,
          target_time_seconds:
            x.target_time_seconds != null ? Number(x.target_time_seconds) : null,
          notes: x.notes != null ? String(x.notes) : null,
          superset_group: x.superset_group != null ? String(x.superset_group) : null,
          superset_index: x.superset_index != null ? Number(x.superset_index) : null,
        }));

        setRows(mapped);
      } catch (e: any) {
        setError(e?.message ? String(e.message) : "Failed to load template");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, templateWorkoutId]);

  const summary = useMemo(() => {
    const exerciseCount = rows.length;

    // Optional: total sets estimate if target_sets exist
    const totalSets = rows.reduce((acc, r) => acc + (r.target_sets ?? 0), 0);
    const setsLabel = totalSets > 0 ? `${totalSets} sets` : null;

    return { exerciseCount, setsLabel };
  }, [rows]);

  async function onStartNow() {
    if (!templateWorkoutId) return;
    if (starting) return;

    setStarting(true);
    setError(null);
    try {
      // ✅ clones template into user's workouts, returns new workout id
      const { data, error } = await supabase.rpc("clone_starter_template", {
        p_template_workout_id: templateWorkoutId,
      });

      if (error) throw error;

      const workoutId = typeof data === "string" ? data : String(data);

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

  const renderRow = ({ item }: { item: Row }) => {
    const targets = fmtTargets(item);
    const superset = groupKey(item);
    const isSuperset = !!superset;

    return (
      <View style={styles.row}>
        <View style={styles.rowTop}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {item.order_index + 1}. {item.exercise_name}
          </Text>

          {isSuperset ? (
            <Pill
              label={`SUPERSET ${item.superset_index != null ? item.superset_index + 1 : ""}`.trim()}
              tone="neutral"
            />
          ) : null}
        </View>

        {!!targets ? (
          <Text style={styles.targets} numberOfLines={1}>
            {targets}
          </Text>
        ) : (
          <Text style={styles.targets} numberOfLines={1}>
            Suggested effort · log what you can
          </Text>
        )}

        {!!item.notes ? (
          <Text style={styles.note} numberOfLines={3}>
            {item.notes}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.screen}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={styles.close}>Close</Text>
          </Pressable>

          <View style={{ flex: 1 }} />

          <Pill label={badgeLabel} tone="primary" />
        </View>

        {/* Big header image */}
        <View style={styles.heroMediaWrap}>
          <ImageBackground
            source={headerImage}
            style={StyleSheet.absoluteFill}
            imageStyle={styles.heroMediaImg}
          >
            <View style={styles.heroMediaOverlay} />
          </ImageBackground>

          <View style={styles.heroTextWrap}>
            <Text style={styles.title} numberOfLines={2}>
              {title || "Starter workout"}
            </Text>

            <Text style={styles.sub} numberOfLines={2}>
              Preview the session. Start once to save it to your workouts and begin.
            </Text>

            {/* Mini stats */}
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statText}>
                  {loading ? "…" : `${summary.exerciseCount} exercises`}
                </Text>
              </View>

              {summary.setsLabel ? (
                <View style={styles.statChip}>
                  <Text style={styles.statText}>{summary.setsLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Exercises list */}
        <Card style={styles.bodyCard}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading exercises…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
              <Text style={styles.muted} numberOfLines={2}>
                If this is a starter template, the preview RPC needs to be enabled.
              </Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(r, idx) => `${r.order_index}:${idx}`}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={renderRow}
              contentContainerStyle={{ paddingVertical: 2 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Card>

        {/* Footer CTA */}
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

    // Big image header
    heroMediaWrap: {
      marginTop: layout.space.md,
      marginHorizontal: layout.space.lg,
      borderRadius: layout.radius.xl,
      overflow: "hidden",
      minHeight: 200,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },

    heroMediaImg: {
      resizeMode: "cover",
    },

    heroMediaOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.18)",
    },

    heroTextWrap: {
      padding: layout.space.lg,
      gap: 8,
      justifyContent: "flex-end",
      minHeight: 200,
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
      lineHeight: typography.lineHeight.body,
    },

    statsRow: {
      marginTop: 4,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
    },

    statChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },

    statText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
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
      paddingHorizontal: 16,
    },

    muted: {
      fontFamily: typography.fontFamily.medium,
      color: colors.textMuted,
      fontSize: typography.size.sub,
      textAlign: "center",
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

    row: {
      gap: 6,
    },

    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },

    exerciseName: {
      flex: 1,
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
      lineHeight: typography.lineHeight.body,
    },

    footer: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.md,
      paddingBottom: layout.space.lg,
      backgroundColor: colors.bg,
    },
  });
