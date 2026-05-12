// app/features/plans/create/Workout.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/authContext";
import {
  usePlanDraft,
  type ExerciseRow,
  type WorkoutDraft,
  type WorkoutExercise,
} from "./store";

type LooseWorkoutRow = {
  id: string;
  title: string;
  notes: string | null;
  created_at: string;
  workout_exercises?: {
    id: string;
    exercise_id: string;
    order_index: number;
    target_sets: number | null;
    target_reps: number | null;
    target_weight: number | null;
    target_time_seconds: number | null;
    target_distance: number | null;
    notes: string | null;
    superset_group: string | null;
    superset_index: number | null;
    is_dropset: boolean | null;
    exercises?: {
      id: string;
      name: string;
      type: "strength" | "cardio" | "mobility" | null;
    } | null;
  }[];
};

function isWorkoutReady(w: any) {
  const titleOk = String(w?.title ?? "").trim().length > 0;
  const exOk = Array.isArray(w?.exercises) && w.exercises.length > 0;
  return titleOk && exOk;
}

export default function PlanCreateWorkouts() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, typography, layout } = useAppTheme();
  const s = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout],
  );

  const { workoutsPerWeek, workouts, setWorkout } = usePlanDraft();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [loadingLooseWorkouts, setLoadingLooseWorkouts] = useState(false);
  const [looseWorkouts, setLooseWorkouts] = useState<LooseWorkoutRow[]>([]);

  const total = Math.max(0, Number(workoutsPerWeek ?? 0));
  const list = Array.isArray(workouts) ? workouts : [];

  const readyCount = useMemo(() => list.filter(isWorkoutReady).length, [list]);
  const allReady = total > 0 && readyCount === total;

  const subtitle = useMemo(() => {
    const n = total || 0;
    return `Create ${n} workout${n === 1 ? "" : "s"} for your week`;
  }, [total]);

  const openWorkout = useCallback((index: number) => {
    router.push({
      pathname: "/features/plans/editor/workoutEditorWrapper",
      params: { index: String(index), mode: "create" },
    });
  }, []);

  const openStarterPicker = useCallback((index: number) => {
    setPickerIndex(index);
    setPickerOpen(true);
  }, []);

  const proceed = useCallback(() => {
    if (!allReady) return;
    router.push("/features/plans/create/goals");
  }, [allReady]);

  useEffect(() => {
    if (!pickerOpen || !userId) return;

    let mounted = true;

    async function loadLooseWorkouts() {
      setLoadingLooseWorkouts(true);

      const { data, error } = await supabase
        .from("workouts")
        .select(
          `
          id,
          title,
          notes,
          created_at,
          workout_exercises (
            id,
            exercise_id,
            order_index,
            target_sets,
            target_reps,
            target_weight,
            target_time_seconds,
            target_distance,
            notes,
            superset_group,
            superset_index,
            is_dropset,
            exercises:exercise_id (
              id,
              name,
              type
            )
          )
        `,
        )
        .eq("user_id", userId)
        .eq("counts_toward_template_limit", true)
        .is("archived_at", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        console.error("Failed to load loose workouts:", error);
        Alert.alert("Could not load workouts", error.message);
        setLooseWorkouts([]);
      } else {
        setLooseWorkouts((data ?? []) as unknown as LooseWorkoutRow[]);
      }

      setLoadingLooseWorkouts(false);
    }

    loadLooseWorkouts();

    return () => {
      mounted = false;
    };
  }, [pickerOpen, userId]);

  function applyLooseWorkout(row: LooseWorkoutRow) {
    if (pickerIndex == null) return;

    const draft = looseWorkoutToDraft(row, pickerIndex);

    setWorkout(pickerIndex, draft);
    setPickerOpen(false);
    setPickerIndex(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.page}>
        <View style={s.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={layout.hitSlop}
            style={s.headerIconBtn}
          >
            <Text style={s.headerIcon}>‹</Text>
          </Pressable>

          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Step 2 of 4</Text>
          </View>
        </View>

        <View style={s.progressWrap}>
          <Text style={s.progressPct}>50%</Text>
        </View>

        <View style={s.progressBarTrack}>
          <View style={[s.progressBarFill, { width: "50%" }]} />
        </View>

        <View style={s.hero}>
          <Text style={s.h1}>Build your week</Text>
          <Text style={s.sub}>{subtitle}</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {Array.from({ length: total }, (_, i) => {
            const w = list[i];
            const ready = isWorkoutReady(w);
            const exCount = Array.isArray(w?.exercises)
              ? w.exercises.length
              : 0;

            const leftBadge = ready ? (
              <View style={[s.badge, s.badgeReady]}>
                <Text style={s.badgeReadyText}>✓</Text>
              </View>
            ) : (
              <View style={[s.badge, s.badgeIdle]}>
                <Text style={s.badgeIdleText}>{exCount > 0 ? "…" : "+"}</Text>
              </View>
            );

            return (
              <Pressable
                key={i}
                onPress={() => openWorkout(i)}
                style={[
                  s.workoutRow,
                  ready && s.workoutRowReady,
                  !ready && exCount > 0 ? s.workoutRowActive : null,
                ]}
              >
                {leftBadge}

                <View style={s.workoutContent}>
                  <View style={s.workoutTopLine}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.workoutTitle} numberOfLines={1}>
                        {String(w?.title ?? `Workout ${i + 1}`)}
                      </Text>

                      {ready ? (
                        <Text style={s.workoutMetaReady}>
                          Ready • {exCount} exercise{exCount === 1 ? "" : "s"}
                        </Text>
                      ) : exCount > 0 ? (
                        <Text style={s.workoutMeta}>
                          {exCount} exercise{exCount === 1 ? "" : "s"} added
                        </Text>
                      ) : (
                        <Text style={s.workoutMeta}>Tap to add exercises</Text>
                      )}
                    </View>

                    <Text style={s.chev}>›</Text>
                  </View>

                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      openStarterPicker(i);
                    }}
                    style={s.inlineStarterBtn}
                  >
                    <Text style={s.inlineStarterBtnText}>
                      Start from existing workout
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {!allReady ? (
            <View style={s.addHint}>
              <Text style={s.addHintText}>
                Use an existing workout as a starting point, then edit it for
                this plan.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={s.bottomDock}>
          <Pressable
            onPress={proceed}
            disabled={!allReady}
            style={[s.cta, !allReady && s.ctaDisabled]}
          >
            <Text style={s.ctaText}>Continue</Text>
          </Pressable>

          {!allReady ? (
            <Text style={s.bottomMeta}>
              {readyCount}/{total} workouts ready
            </Text>
          ) : null}
        </View>
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={s.modalScrim}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Use existing workout</Text>
                <Text style={s.modalSub}>
                  This copies it into the plan. You can still edit it after.
                </Text>
              </View>

              <Pressable
                onPress={() => setPickerOpen(false)}
                hitSlop={layout.hitSlop}
                style={s.closeBtn}
              >
                <Text style={s.closeText}>✕</Text>
              </Pressable>
            </View>

            {loadingLooseWorkouts ? (
              <View style={s.modalLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={s.workoutMeta}>Loading workouts…</Text>
              </View>
            ) : looseWorkouts.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyTitle}>No loose workouts yet</Text>
                <Text style={s.emptyText}>
                  Build this workout from scratch for now. Saved standalone
                  workouts will appear here later.
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={{
                  gap: layout.space.sm,
                  paddingBottom: 12,
                }}
                showsVerticalScrollIndicator={false}
              >
                {looseWorkouts.map((w) => {
                  const exCount = Array.isArray(w.workout_exercises)
                    ? w.workout_exercises.length
                    : 0;

                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => applyLooseWorkout(w)}
                      style={s.templateRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.templateTitle} numberOfLines={1}>
                          {w.title || "Untitled Workout"}
                        </Text>
                        <Text style={s.templateMeta}>
                          {exCount} exercise{exCount === 1 ? "" : "s"}
                        </Text>
                      </View>

                      <Text style={s.chev}>›</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function looseWorkoutToDraft(
  row: LooseWorkoutRow,
  index: number,
): WorkoutDraft {
  const sortedExercises = [...(row.workout_exercises ?? [])].sort(
    (a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0),
  );

  const exercises: WorkoutExercise[] = sortedExercises
    .filter((we) => !!we.exercises?.id)
    .map((we, idx) => {
      const exercise: ExerciseRow = {
        id: String(we.exercises!.id),
        name: String(we.exercises!.name),
        type: we.exercises!.type ?? null,
      };

      return {
        exercise,
        order_index: idx,
        supersetGroup: we.superset_group ?? null,
        isDropset: !!we.is_dropset,
        target_sets: we.target_sets ?? null,
        target_reps: we.target_reps ?? null,
        target_weight: we.target_weight ?? null,
        target_time_seconds: we.target_time_seconds ?? null,
        target_distance: we.target_distance ?? null,
        notes: we.notes ?? null,
      };
    });

  return {
    title: row.title?.trim() || `Workout ${index + 1}`,
    notes: row.notes ?? null,
    exercises,
  };
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingBottom: layout.space.lg,
    },

    /* header */
    header: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.sm,
      paddingBottom: layout.space.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
    },
    headerIconBtn: {
      width: 44,
      height: 44,
      borderRadius: layout.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    headerIcon: {
      color: colors.text,
      fontSize: 26,
      fontFamily: typography.fontFamily.bold,
      marginTop: -2,
    },
    help: {
      color: colors.textMuted,
      fontSize: 18,
      fontFamily: typography.fontFamily.bold,
      marginTop: -1,
    },
    headerCenter: { flex: 1, alignItems: "center" },
    headerTitle: {
      color: colors.text,
      fontSize: typography.size.sub,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 0.2,
    },

    /* progress */
    progressWrap: {
      paddingHorizontal: layout.space.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginTop: 2,
    },
    progressLabel: {
      color: colors.textMuted,
      fontSize: typography.size.meta,
      fontFamily: typography.fontFamily.medium,
    },
    progressPct: {
      color: colors.textMuted,
      fontSize: typography.size.meta,
      fontFamily: typography.fontFamily.medium,
    },
    progressBarTrack: {
      marginTop: layout.space.sm,
      marginHorizontal: layout.space.lg,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.trackBg,
      overflow: "hidden",
    },
    progressBarFill: {
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },

    /* hero */
    hero: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.lg,
      paddingBottom: layout.space.md,
    },
    h1: {
      color: colors.text,
      fontSize: typography.size.h1,
      lineHeight: typography.lineHeight.h1,
      fontFamily: typography.fontFamily.bold,
      letterSpacing: -0.3,
    },
    sub: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      fontFamily: typography.fontFamily.medium,
    },

    /* list */
    list: {
      paddingHorizontal: layout.space.lg,
      gap: layout.space.md,
      flex: 1,
      paddingTop: layout.space.sm,
    },

    workoutRowActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },

    badge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeReady: {
      backgroundColor: colors.successBg,
      borderWidth: 1,
      borderColor: colors.success,
    },
    badgeReadyText: {
      color: colors.success,
      fontFamily: typography.fontFamily.bold,
      fontSize: 16,
      marginTop: -1,
    },
    badgeIdle: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeIdleText: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.bold,
      fontSize: 16,
      marginTop: -1,
    },

    workoutTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
    workoutMetaReady: {
      marginTop: 4,
      color: colors.success,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },
    workoutMeta: {
      marginTop: 4,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },

    rightWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    editPill: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editPillText: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.bold,
      fontSize: 12,
      letterSpacing: 0.6,
    },
    chev: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.bold,
      fontSize: 20,
      marginTop: -2,
    },

    addHint: {
      marginTop: 4,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: layout.radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addHintText: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },

    /* bottom */
    bottomDock: {
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.sm,
      gap: layout.space.sm,
    },
    cta: {
      height: 56,
      borderRadius: layout.radius.xl,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaDisabled: {
      opacity: 0.45,
    },
    ctaText: {
      color: colors.onPrimary,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
    bottomMeta: {
      textAlign: "center",
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },

    workoutCardWrap: {
      gap: layout.space.sm,
    },
    rowActions: {
      flexDirection: "row",
      gap: layout.space.sm,
      paddingHorizontal: 2,
    },
    secondaryBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: layout.radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: layout.space.md,
    },
    secondaryBtnText: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      textAlign: "center",
    },
    editBtn: {
      minHeight: 42,
      borderRadius: layout.radius.lg,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: layout.space.lg,
    },
    editBtnText: {
      color: colors.onPrimary,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
    },
    modalScrim: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
    },
    modalCard: {
      maxHeight: "78%",
      backgroundColor: colors.bg,
      borderTopLeftRadius: layout.radius.xl,
      borderTopRightRadius: layout.radius.xl,
      padding: layout.space.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: layout.space.md,
      marginBottom: layout.space.md,
    },
    modalTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h3,
      lineHeight: typography.lineHeight.h3,
    },
    modalSub: {
      marginTop: 4,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    closeText: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.bold,
      fontSize: 14,
    },
    modalLoading: {
      minHeight: 140,
      alignItems: "center",
      justifyContent: "center",
      gap: layout.space.sm,
    },
    emptyState: {
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    emptyTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
    },
    emptyText: {
      marginTop: 4,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },
    templateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    templateTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
    },
    templateMeta: {
      marginTop: 3,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
    },

    workoutRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: layout.space.md,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: layout.radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    workoutRowReady: {
      borderColor: colors.success,
    },

    workoutContent: {
      flex: 1,
      gap: layout.space.sm,
    },

    workoutTopLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
    },

    inlineStarterBtn: {
      alignSelf: "flex-start",
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    inlineStarterBtnText: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
    },
  });
