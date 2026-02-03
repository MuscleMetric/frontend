// app/features/plans/create/Workout.tsx
import React, { useMemo, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/lib/useAppTheme";
import { usePlanDraft } from "./store";

function isWorkoutReady(w: any) {
  const titleOk = String(w?.title ?? "").trim().length > 0;
  const exOk = Array.isArray(w?.exercises) && w.exercises.length > 0;
  return titleOk && exOk;
}

export default function PlanCreateWorkouts() {
  const { colors, typography, layout } = useAppTheme();
  const s = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const { workoutsPerWeek, workouts } = usePlanDraft();

  const total = Math.max(0, Number(workoutsPerWeek ?? 0));
  const list = Array.isArray(workouts) ? workouts : [];

  const readyCount = useMemo(() => list.filter(isWorkoutReady).length, [list]);
  const allReady = total > 0 && readyCount === total;

  const subtitle = useMemo(() => {
    const n = total || 0;
    return `Create ${n} workout${n === 1 ? "" : "s"} for your week`;
  }, [total]);

  const openWorkout = useCallback(
    (index: number) => {
      // Uses your shared Plan Workout Editor screen (create/edit can both use it).
      // Create this route at: app/features/plans/editor/workoutEditor.tsx
      router.push({
        pathname: "/features/plans/editor/workoutEditor",
        params: { index: String(index), mode: "create" },
      });
    },
    []
  );

  const proceed = useCallback(() => {
    if (!allReady) return;
    router.push("/features/plans/create/goals");
  }, [allReady]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={layout.hitSlop} style={s.headerIconBtn}>
            <Text style={s.headerIcon}>‹</Text>
          </Pressable>

          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Step 2 of 4</Text>
          </View>

          <Pressable
            onPress={() => router.back()}
            hitSlop={layout.hitSlop}
            style={s.headerIconBtn}
          >
            <Text style={s.help}>?</Text>
          </Pressable>
        </View>

        {/* Progress */}
        <View style={s.progressWrap}>
          <Text style={s.progressLabel}>Wizard Progress</Text>
          <Text style={s.progressPct}>50%</Text>
        </View>
        <View style={s.progressBarTrack}>
          <View style={[s.progressBarFill, { width: "50%" }]} />
        </View>

        {/* Title */}
        <View style={s.hero}>
          <Text style={s.h1}>Build your week</Text>
          <Text style={s.sub}>{subtitle}</Text>
        </View>

        {/* Workouts list */}
        <View style={s.list}>
          {Array.from({ length: total }, (_, i) => {
            const w = list[i];
            const ready = isWorkoutReady(w);
            const exCount = Array.isArray(w?.exercises) ? w.exercises.length : 0;

            // styling matches your mock: first = ready chip, middle = “…” chip, etc.
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
                style={[s.workoutRow, !ready && exCount > 0 ? s.workoutRowActive : null]}
              >
                {leftBadge}

                <View style={{ flex: 1 }}>
                  <Text style={s.workoutTitle} numberOfLines={1}>
                    {String(w?.title ?? `Workout ${i + 1}`)}
                  </Text>

                  {ready ? (
                    <Text style={s.workoutMetaReady}>Ready</Text>
                  ) : exCount > 0 ? (
                    <Text style={s.workoutMeta}>{exCount} exercise{exCount === 1 ? "" : "s"} added</Text>
                  ) : (
                    <Text style={s.workoutMeta}>Tap to add exercises</Text>
                  )}
                </View>

                <View style={s.rightWrap}>
                  {exCount > 0 && !ready ? (
                    <View style={s.editPill}>
                      <Text style={s.editPillText}>EDIT</Text>
                    </View>
                  ) : null}
                  <Text style={s.chev}>›</Text>
                </View>
              </Pressable>
            );
          })}

          {/* Optional “Add exercises” helper row when at least one workout is empty */}
          {!allReady ? (
            <View style={s.addHint}>
              <Text style={s.addHintText}>Tip: open each workout and add exercises to enable Continue.</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom CTA */}
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
    </SafeAreaView>
  );
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
      justifyContent: "space-between",
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
      justifyContent: "space-between",
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

    workoutRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: layout.radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
  });
