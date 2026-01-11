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
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { supabase } from "../../../../../lib/supabase";
import { Button, Card, Pill, WorkoutCover } from "@/ui";

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
  imageKey,
  badgeLabel = "STARTER",
}: {
  visible: boolean;
  templateWorkoutId: string | null;
  title?: string;
  onClose: () => void;
  imageKey?: string | null; // expects keys like "cardio" | "push" | ...
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

  // --- Bottom sheet sizing ---
  const { height: screenH } = Dimensions.get("window");

  // ✅ change this to make the modal taller/shorter (0.60 = 60% screen height)
  const SHEET_RATIO = 0.85;

  const sheetHeight = Math.round(screenH * SHEET_RATIO);

  // show ~4 exercises before scroll (adjust if your row visuals change)
  const LIST_MAX_HEIGHT = 280;

  useEffect(() => {
    if (!visible) return;
    if (!templateWorkoutId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.rpc(
          "get_starter_template_preview",
          { p_template_workout_id: templateWorkoutId }
        );

        if (cancelled) return;
        if (error) throw error;

        const mapped: Row[] = (data ?? []).map((x: any) => ({
          order_index: Number(x.order_index ?? 0),
          exercise_name: String(x.exercise_name ?? "Exercise"),
          target_sets: x.target_sets != null ? Number(x.target_sets) : null,
          target_reps: x.target_reps != null ? Number(x.target_reps) : null,
          target_time_seconds:
            x.target_time_seconds != null
              ? Number(x.target_time_seconds)
              : null,
          notes: x.notes != null ? String(x.notes) : null,
          superset_group:
            x.superset_group != null ? String(x.superset_group) : null,
          superset_index:
            x.superset_index != null ? Number(x.superset_index) : null,
        }));

        setRows(mapped);
      } catch (e: any) {
        setError(
          e?.message ? String(e.message) : "Failed to load workout preview"
        );
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
    const totalSets = rows.reduce((acc, r) => acc + (r.target_sets ?? 0), 0);
    const setsLabel = totalSets > 0 ? `${totalSets} sets` : null;

    const hasAnyTargets = rows.some(
      (r) =>
        (r.target_sets ?? 0) > 0 ||
        (r.target_reps ?? 0) > 0 ||
        (r.target_time_seconds ?? 0) > 0
    );

    return { exerciseCount, setsLabel, hasAnyTargets };
  }, [rows]);

  const coverSubtitle = useMemo(() => {
    if (loading) return "Loading preview…";
    if (error) return "Couldn’t load preview";
    if (summary.exerciseCount > 0 && summary.setsLabel)
      return `${summary.exerciseCount} exercises · ${summary.setsLabel}`;
    if (summary.exerciseCount > 0) return `${summary.exerciseCount} exercises`;
    return "Preview the session";
  }, [loading, error, summary.exerciseCount, summary.setsLabel]);

  async function onStartNow() {
    if (!templateWorkoutId) return;
    if (starting) return;

    setStarting(true);
    setError(null);
    try {
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

  // ✅ Fix numbering:
  // - Some queries return order_index starting at 0, some at 1.
  // - We normalize so the UI always starts at 1.
  const indexBase = useMemo(() => {
    if (!rows.length) return 0;
    const min = Math.min(...rows.map((r) => r.order_index ?? 0));
    return min; // if min=0 => base 0, if min=1 => base 1
  }, [rows]);

  const renderRow = ({ item, index }: { item: Row; index: number }) => {
    const targets = fmtTargets(item);
    const superset = groupKey(item);
    const isSuperset = !!superset;

    const displayIndex = item.order_index - indexBase + 1;

    return (
      <View style={styles.row}>
        <View style={styles.rowTop}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {displayIndex}. {item.exercise_name}
          </Text>

          {isSuperset ? (
            <Pill
              label={`SUPERSET ${
                item.superset_index != null ? item.superset_index + 1 : ""
              }`.trim()}
              tone="neutral"
            />
          ) : null}
        </View>

        <Text style={styles.targets} numberOfLines={1}>
          {targets || "Suggested effort · log what you can"}
        </Text>

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
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      {/* Overlay (tap to close) */}
      <Pressable style={styles.overlay} onPress={onClose} />

      {/* Bottom sheet */}
      <View style={[styles.sheet, { height: sheetHeight }]}>
        {/* Handle + top row */}
        <View style={styles.sheetTop}>
          <View style={styles.handle} />

          <View style={styles.topBar}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [pressed ? { opacity: 0.7 } : null]}
            >
              <Text style={styles.close}>Close</Text>
            </Pressable>

            <View style={{ flex: 1 }} />

            {/* ✅ No more empty pill (circle). Always render text. */}
            <Pill label={String(badgeLabel || "STARTER")} tone="neutral" />
          </View>
        </View>

        {/* Header image */}
        <View style={styles.heroWrap}>
          <WorkoutCover
            imageKey={imageKey ?? "full_body"}
            height={210}
            radius={layout.radius.xl}
            title={title || "Starter workout"}
            subtitle={coverSubtitle}
            badge={null}
            badgePosition="topLeft"
            focusY={0.55}
          />
        </View>

        {/* Supporting copy */}
        <View style={styles.headerCopy}>
          <Text style={styles.sub} numberOfLines={2}>
            Preview the session. Start once to save it to your workouts and
            begin.
          </Text>

          {!summary.hasAnyTargets ? (
            <Text style={styles.hint} numberOfLines={2}>
              Tip: These are starter sessions — adjust weights and reps to match
              your level.
            </Text>
          ) : null}
        </View>

        {/* Exercises list (intentionally not full height) */}
        <Card style={{ ...styles.bodyCard, maxHeight: LIST_MAX_HEIGHT }}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading exercises…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
              <Text style={styles.muted} numberOfLines={2}>
                If this is a template workout, ensure the preview RPC is
                returning rows.
              </Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(r, idx) => `${r.order_index}:${idx}`}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={renderRow}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 2 }}
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
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.40)",
    },

    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.bg,
      borderTopLeftRadius: layout.radius.xl,
      borderTopRightRadius: layout.radius.xl,
      overflow: "hidden",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    sheetTop: {
      paddingTop: 10,
      paddingBottom: 6,
    },

    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.border,
      opacity: 0.9,
      marginBottom: 10,
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

    heroWrap: {
      marginTop: 8,
      marginHorizontal: layout.space.lg,
    },

    headerCopy: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.md,
      gap: 6,
    },

    sub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      color: colors.textMuted,
      lineHeight: typography.lineHeight.body,
    },

    hint: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
      lineHeight: typography.lineHeight.body,
      opacity: 0.9,
    },

    bodyCard: {
      marginHorizontal: layout.space.lg,
      marginTop: layout.space.md,
      borderRadius: layout.radius.xl,
      padding: layout.space.lg,
    },

    center: {
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      paddingVertical: 18,
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
