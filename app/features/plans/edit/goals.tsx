// app/features/plans/edit/goals.tsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { ScreenHeader, Icon } from "@/ui";

import { useEditPlan, type ExerciseRow, type GoalDraft } from "./store";

/** Helpers for mode <-> unit */
const MODE_UNIT: Record<GoalDraft["mode"], string> = {
  exercise_weight: "kg",
  exercise_reps: "reps",
  distance: "km",
  time: "min",
};

type DedupExercise = {
  exercise: ExerciseRow;
  workoutTitles: string[];
};

type LastMetric = {
  weight?: number | null;
  reps?: number | null;
  time_minutes?: number | null;
  distance?: number | null;
};

function labelForMode(m: GoalDraft["mode"]) {
  switch (m) {
    case "exercise_weight":
      return "Weight";
    case "exercise_reps":
      return "Reps";
    case "distance":
      return "Distance";
    case "time":
      return "Time";
  }
}

function modeOptionsForExercise(ex: ExerciseRow): GoalDraft["mode"][] {
  const t = (ex.type ?? "").toLowerCase();
  return t === "cardio"
    ? ["distance", "time"]
    : ["exercise_weight", "exercise_reps"];
}

function getWeeksBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end.getTime() - start.getTime();
  const weeks = diffMs / (1000 * 60 * 60 * 24 * 7);
  return Math.max(1, Math.round(weeks));
}

function roundForMode(mode: GoalDraft["mode"], n: number) {
  if (!isFinite(n)) return 0;
  return mode === "time" ? Number(n.toFixed(1)) : Math.round(n);
}

function fmtForMode(mode: GoalDraft["mode"], n: number) {
  return mode === "time" ? n.toFixed(1) : String(Math.round(n));
}

function increaseRange(start: number, weeks: number, mode: GoalDraft["mode"]) {
  const min = start * (1 + 0.01 * weeks);
  const max = start * (1 + 0.05 * weeks);
  const suggested = (min + max) / 2;
  return {
    min: roundForMode(mode, min),
    max: roundForMode(mode, max),
    suggested: roundForMode(mode, suggested),
  };
}

function decreaseRange(start: number, weeks: number, mode: GoalDraft["mode"]) {
  const max = Math.max(0, start * (1 - 0.01 * weeks));
  const min = Math.max(0, start * (1 - 0.05 * weeks));
  const suggested = (min + max) / 2;
  return {
    min: roundForMode(mode, min),
    max: roundForMode(mode, max),
    suggested: roundForMode(mode, suggested),
  };
}

function calcRangeForMode(
  mode: GoalDraft["mode"],
  start: number,
  weeks: number
) {
  // time goals typically aim to decrease
  return mode === "time"
    ? decreaseRange(start, weeks, mode)
    : increaseRange(start, weeks, mode);
}

function pickStartForMode(mode: GoalDraft["mode"], last?: LastMetric) {
  if (!last) return null;

  if (mode === "exercise_weight") {
    return typeof last.weight === "number" ? roundForMode(mode, last.weight) : null;
  }
  if (mode === "exercise_reps") {
    return typeof last.reps === "number" ? roundForMode(mode, last.reps) : null;
  }
  if (mode === "distance") {
    return typeof last.distance === "number"
      ? roundForMode(mode, last.distance)
      : null;
  }
  if (mode === "time") {
    return typeof last.time_minutes === "number"
      ? roundForMode(mode, last.time_minutes)
      : null;
  }
  return null;
}

export default function EditGoals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, typography, layout } = useAppTheme() as any;
  const s = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const { workouts, goals: storeGoals, setGoals, endDate } = useEditPlan();

  // Local buffer so we can Cancel without mutating store
  const [localGoals, setLocalGoals] = useState<GoalDraft[]>(storeGoals ?? []);

  // last metrics map for autofill
  const [lastMap, setLastMap] = useState<Record<string, LastMetric>>({});

  useEffect(() => {
    setLocalGoals(storeGoals ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only once on mount

  // Plan length (weeks)
  const todayIso = new Date().toISOString().slice(0, 10);
  const planWeeks = endDate ? getWeeksBetween(todayIso, endDate) : 0;

  // Dedup exercises across workouts
  const deduped: DedupExercise[] = useMemo(() => {
    const map = new Map<string, DedupExercise>();
    for (const w of workouts ?? []) {
      for (const ex of w.exercises ?? []) {
        const id = String(ex.exercise.id);
        if (!id) continue;

        if (!map.has(id)) {
          map.set(id, {
            exercise: ex.exercise,
            workoutTitles: [w.title ?? "Workout"],
          });
        } else {
          const entry = map.get(id)!;
          const wt = w.title ?? "Workout";
          if (!entry.workoutTitles.includes(wt)) entry.workoutTitles.push(wt);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.exercise.name.localeCompare(b.exercise.name)
    );
  }, [workouts]);

  const allExerciseIds = useMemo(
    () => deduped.map((d) => String(d.exercise.id)).filter(Boolean),
    [deduped]
  );

  const fetchLastMetrics = useCallback(async () => {
    if (!userId) return;
    if (!allExerciseIds.length) return;

    try {
      // RPC returns rows per set; we reduce to "best last-known" values per exercise.
      const { data, error } = await supabase.rpc("get_last_exercise_session_sets", {
        p_user_id: userId,
        p_exercise_ids: allExerciseIds,
      });

      if (error) throw error;

      const next: Record<string, LastMetric> = {};

      (data ?? []).forEach((r: any) => {
        const exId = String(r.exercise_id ?? "");
        if (!exId) return;

        const w = typeof r.weight === "number" ? r.weight : r.weight != null ? Number(r.weight) : null;
        const reps = typeof r.reps === "number" ? r.reps : r.reps != null ? Number(r.reps) : null;
        const dist =
          typeof r.distance === "number" ? r.distance : r.distance != null ? Number(r.distance) : null;
        const tsec =
          typeof r.time_seconds === "number"
            ? r.time_seconds
            : r.time_seconds != null
            ? Number(r.time_seconds)
            : null;

        if (!next[exId]) next[exId] = {};

        // pick max values from last session sets
        if (w != null) next[exId].weight = Math.max(next[exId].weight ?? 0, w);
        if (reps != null) next[exId].reps = Math.max(next[exId].reps ?? 0, reps);
        if (dist != null) next[exId].distance = Math.max(next[exId].distance ?? 0, dist);
        if (tsec != null) {
          const minutes = tsec / 60;
          next[exId].time_minutes = Math.max(next[exId].time_minutes ?? 0, minutes);
        }
      });

      setLastMap(next);
    } catch (e: any) {
      // Non-fatal: just skip autofill
      console.warn("get_last_exercise_session_sets failed:", e?.message ?? e);
    }
  }, [userId, allExerciseIds]);

  useEffect(() => {
    fetchLastMetrics();
  }, [fetchLastMetrics]);

  const findGoal = (exerciseId: string) =>
    localGoals.find((g) => String(g.exercise.id) === String(exerciseId));

  const isDirty = useMemo(() => {
    const a = JSON.stringify(
      (storeGoals ?? []).map((g) => ({
        exerciseId: g.exercise.id,
        mode: g.mode,
        unit: g.unit ?? null,
        start: g.start ?? null,
        target: Number(g.target ?? 0),
      }))
    );
    const b = JSON.stringify(
      (localGoals ?? []).map((g) => ({
        exerciseId: g.exercise.id,
        mode: g.mode,
        unit: g.unit ?? null,
        start: g.start ?? null,
        target: Number(g.target ?? 0),
      }))
    );
    return a !== b;
  }, [storeGoals, localGoals]);

  const selectedGoals = useMemo(() => {
    return (localGoals ?? []).slice().sort((a, b) =>
      a.exercise.name.localeCompare(b.exercise.name)
    );
  }, [localGoals]);

  const unselected = useMemo(() => {
    const selectedIds = new Set((localGoals ?? []).map((g) => String(g.exercise.id)));
    return deduped.filter((d) => !selectedIds.has(String(d.exercise.id)));
  }, [deduped, localGoals]);

  function toggleExercise(ex: ExerciseRow) {
    const exists = findGoal(ex.id);
    if (exists) {
      setLocalGoals(localGoals.filter((g) => g.exercise.id !== ex.id));
      return;
    }
    if (localGoals.length >= 3) {
      Alert.alert("Limit reached", "You can select up to 3 goals.");
      return;
    }

    const firstMode = modeOptionsForExercise(ex)[0];
    const last = lastMap[String(ex.id)];
    const autoStart = pickStartForMode(firstMode, last);

    const suggestedTarget =
      autoStart != null && planWeeks > 0
        ? calcRangeForMode(firstMode, autoStart, planWeeks).suggested
        : 0;

    const newGoal: GoalDraft = {
      id: null,
      exercise: ex,
      mode: firstMode,
      unit: MODE_UNIT[firstMode],
      start: autoStart,
      target: autoStart != null ? suggestedTarget : 0,
    };

    setLocalGoals([...localGoals, newGoal]);
  }

  function updateGoal(
    exerciseId: string,
    patch: Partial<Pick<GoalDraft, "mode" | "unit" | "start" | "target">>
  ) {
    setLocalGoals(
      localGoals.map((g) =>
        g.exercise.id === exerciseId ? { ...g, ...patch } : g
      )
    );
  }

  function onChangeMode(ex: ExerciseRow, goal: GoalDraft, nextMode: GoalDraft["mode"]) {
    const last = lastMap[String(ex.id)];
    const autoStart = pickStartForMode(nextMode, last);

    const nextTarget =
      autoStart != null && planWeeks > 0
        ? calcRangeForMode(nextMode, autoStart, planWeeks).suggested
        : goal.target;

    updateGoal(ex.id, {
      mode: nextMode,
      unit: MODE_UNIT[nextMode],
      start: goal.start == null ? autoStart : goal.start, // only autofill if start is empty
      target: goal.start == null && autoStart != null ? nextTarget : nextTarget,
    });
  }

  function onSave() {
    if (localGoals.length > 3) {
      Alert.alert("Too many goals", "You can select up to 3 goals.");
      return;
    }

    const cleaned = localGoals.map((g) => ({
      ...g,
      start: g.start == null ? null : Number(g.start),
      target: Number(g.target ?? 0),
      unit: g.unit ?? MODE_UNIT[g.mode],
    }));

    setGoals(cleaned);
    router.back();
  }

  const footerH = 92 + insets.bottom;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
      <ScreenHeader
        title="Goals"
        showBack
        right={
          <View style={{ width: 64, alignItems: "flex-end" }}>
            {isDirty ? (
              <View style={s.dirtyPill}>
                <Text numberOfLines={1} style={s.dirtyPillText}>
                  Edited
                </Text>
              </View>
            ) : (
              <Icon name="checkmark-circle" size={18} color={colors.success} />
            )}
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.md,
          paddingBottom: footerH + layout.space.lg,
          gap: layout.space.lg,
        }}
      >
        {/* Top copy */}
        <View style={{ gap: 6 }}>
          <Text style={s.h1}>Track up to 3 goals</Text>
          <Text style={s.sub}>
            We’ll auto-fill the starting value from your last logged session where possible.
          </Text>
        </View>

        {/* Selected section */}
        <View style={{ gap: layout.space.sm }}>
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>SELECTED</Text>
            <Text style={s.sectionMeta}>{selectedGoals.length}/3</Text>
          </View>

          {selectedGoals.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No goals selected</Text>
              <Text style={s.emptySub}>
                Pick exercises from your plan below to start tracking.
              </Text>
            </View>
          ) : (
            <View style={{ gap: layout.space.sm }}>
              {selectedGoals.map((g) => {
                const modes = modeOptionsForExercise(g.exercise);

                return (
                  <View key={g.exercise.id} style={s.goalCard}>
                    <View style={s.goalHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.goalTitle} numberOfLines={1}>
                          {g.exercise.name}
                        </Text>
                        <Text style={s.goalSub} numberOfLines={1}>
                          {g.mode === "exercise_weight"
                            ? "Increase weight"
                            : g.mode === "exercise_reps"
                            ? "Increase reps"
                            : g.mode === "distance"
                            ? "Increase distance"
                            : "Reduce time"}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => toggleExercise(g.exercise)}
                        hitSlop={10}
                        style={s.removePill}
                      >
                        <Icon name="close" size={16} color={colors.danger} />
                        <Text style={s.removeText}>Remove</Text>
                      </Pressable>
                    </View>

                    {/* Mode chips */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {modes.map((m) => {
                        const active = g.mode === m;
                        return (
                          <Pressable
                            key={m}
                            onPress={() => onChangeMode(g.exercise, g, m)}
                            style={[s.chip, active && s.chipActive]}
                          >
                            <Text
                              style={{
                                color: active ? (colors.onPrimary ?? "#fff") : colors.text,
                                fontFamily: typography.fontFamily.semibold,
                                fontSize: 12,
                              }}
                            >
                              {labelForMode(m)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Start/Target */}
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fieldLabel}>Start</Text>
                        <TextInput
                          style={s.input}
                          placeholder="—"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          value={g.start != null ? String(g.start) : ""}
                          onChangeText={(v) => {
                            const raw = v === "" ? null : Number(v);
                            const val = raw == null ? null : roundForMode(g.mode, raw);

                            if (val != null && planWeeks > 0) {
                              const { suggested } = calcRangeForMode(g.mode, val, planWeeks);
                              updateGoal(g.exercise.id, {
                                start: val,
                                target: suggested,
                                unit: MODE_UNIT[g.mode],
                              });
                            } else {
                              updateGoal(g.exercise.id, { start: val, unit: MODE_UNIT[g.mode] });
                            }
                          }}
                        />
                      </View>

                      <View style={s.unitPillWrap}>
                        <Text style={s.unitPill}>{MODE_UNIT[g.mode]}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={s.fieldLabel}>Target</Text>
                        <TextInput
                          style={s.input}
                          placeholder="—"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          value={g.target != null ? String(g.target) : ""}
                          onChangeText={(v) => {
                            const raw = v === "" ? 0 : Number(v);
                            const val = roundForMode(g.mode, raw);
                            updateGoal(g.exercise.id, { target: val, unit: MODE_UNIT[g.mode] });
                          }}
                        />
                      </View>
                    </View>

                    {/* Recommended */}
                    {g.start != null && planWeeks > 0 ? (
                      <Text style={s.recoText}>
                        {(() => {
                          const { min, max } = calcRangeForMode(g.mode, g.start!, planWeeks);
                          return `Recommended target: ${fmtForMode(g.mode, min)}–${fmtForMode(
                            g.mode,
                            max
                          )} ${MODE_UNIT[g.mode]}`;
                        })()}
                      </Text>
                    ) : (
                      <Text style={s.recoMuted}>
                        Tip: enter a start value to get an auto-recommended target.
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Available exercises */}
        <View style={{ gap: layout.space.sm }}>
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>AVAILABLE EXERCISES</Text>
            <Text style={s.sectionMeta}>{unselected.length}</Text>
          </View>

          {deduped.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No exercises in this plan yet</Text>
              <Text style={s.emptySub}>
                Add exercises to your workouts first, then come back to set goals.
              </Text>
            </View>
          ) : (
            <View style={{ gap: layout.space.sm }}>
              {unselected.map(({ exercise, workoutTitles }) => {
                const contextText =
                  workoutTitles.length > 0 ? workoutTitles.join(", ") : "—";

                const disabled = selectedGoals.length >= 3;

                return (
                  <Pressable
                    key={exercise.id}
                    onPress={() => (!disabled ? toggleExercise(exercise) : null)}
                    style={({ pressed }) => [
                      s.pickRow,
                      pressed && !disabled ? { opacity: 0.9 } : null,
                      disabled ? { opacity: 0.55 } : null,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickTitle} numberOfLines={1}>
                        {exercise.name}
                      </Text>
                      <Text style={s.pickSub} numberOfLines={1}>
                        {contextText}
                      </Text>
                    </View>

                    <View style={s.pickRight}>
                      <View style={s.addPill}>
                        <Icon name="add" size={16} color={colors.text} />
                        <Text style={s.addText}>Add</Text>
                      </View>
                      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {deduped.length > 0 ? (
            <Text style={s.hint}>
              {selectedGoals.length}/3 goals selected
              {isDirty ? " • Unsaved changes" : ""}
            </Text>
          ) : null}
        </View>

        {!userId ? (
          <Text style={s.recoMuted}>You’re not signed in — start autofill is disabled.</Text>
        ) : null}
      </ScrollView>

      {/* Sticky footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + layout.space.md }]}>
        <View style={{ flexDirection: "row", gap: layout.space.sm }}>
          <Pressable style={s.footerBtnGhost} onPress={() => router.back()}>
            <Text style={s.footerGhostText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[s.footerBtnPrimary, !isDirty && { opacity: 0.55 }]}
            onPress={onSave}
            disabled={!isDirty}
          >
            <Text style={s.footerPrimaryText}>Save goals</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* -------- themed styles -------- */

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    h1: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 22,
      letterSpacing: -0.3,
    },
    sub: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 13,
      lineHeight: 18,
    },

    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 2,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 0.9,
      fontFamily: typography.fontFamily.semibold,
    },
    sectionMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: typography.fontFamily.semibold,
    },

    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: layout.space.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 6,
    },
    emptyTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 15,
    },
    emptySub: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 13,
      lineHeight: 18,
    },

    goalCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: layout.space.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: layout.space.md,
    },
    goalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    goalTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 16,
    },
    goalSub: {
      marginTop: 4,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 12,
    },

    removePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    removeText: {
      color: colors.danger,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
    },

    chip: {
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    fieldLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      marginBottom: 8,
    },

    input: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 14,
    },

    unitPillWrap: { paddingTop: 20 },
    unitPill: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },

    recoText: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
    },
    recoMuted: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 12,
    },

    pickRow: {
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingHorizontal: layout.space.lg,
      paddingVertical: layout.space.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    pickTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 15,
    },
    pickSub: {
      marginTop: 4,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 12,
    },
    pickRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    addPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    addText: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
    },

    hint: {
      marginTop: 6,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      paddingHorizontal: 2,
    },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: layout.space.lg,
      paddingTop: 12,
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    footerBtnGhost: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    footerGhostText: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
    },
    footerBtnPrimary: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    footerPrimaryText: {
      color: colors.onPrimary ?? "#fff",
      fontFamily: typography.fontFamily.bold,
    },

    dirtyPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.primaryBg ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexShrink: 0,
    },
    dirtyPillText: {
      color: colors.primaryText ?? colors.primary,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
    },
  });
