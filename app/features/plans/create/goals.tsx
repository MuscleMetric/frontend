// app/features/plans/create/goals.tsx
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { usePlanDraft, type ExerciseRow, type GoalDraft } from "./store";

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

type FilterTab = "all" | "strength" | "cardio";

export default function Goals() {
  const { colors, typography, layout } = useAppTheme();
  const s = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const { workouts, goals, setGoals, endDate } = usePlanDraft();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

  // Plan length (weeks)
  const todayIso = new Date().toISOString().slice(0, 10);
  const planWeeks = endDate ? getWeeksBetween(todayIso, endDate) : 0;

  // Dedup exercises across workouts
  const deduped: DedupExercise[] = useMemo(() => {
    const map = new Map<string, DedupExercise>();
    for (const w of workouts) {
      for (const ex of w.exercises) {
        const id = ex.exercise.id;
        if (!map.has(id)) {
          map.set(id, { exercise: ex.exercise, workoutTitles: [w.title] });
        } else {
          const entry = map.get(id)!;
          if (!entry.workoutTitles.includes(w.title)) entry.workoutTitles.push(w.title);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.exercise.name.localeCompare(b.exercise.name)
    );
  }, [workouts]);

  const findGoal = useCallback(
    (exerciseId: string) => goals.find((g) => g.exercise.id === exerciseId) ?? null,
    [goals]
  );

  function modeOptionsForExercise(ex: ExerciseRow): GoalDraft["mode"][] {
    return ex.type === "cardio" ? ["distance", "time"] : ["exercise_weight", "exercise_reps"];
  }

  // select / deselect (min 1, max 3)
  function toggleExercise(ex: ExerciseRow) {
    const exists = findGoal(ex.id);

    if (exists) {
      if (goals.length <= 1) {
        Alert.alert("At least one goal", "You need at least one goal exercise in your plan.");
        return;
      }
      setGoals(goals.filter((g) => g.exercise.id !== ex.id));
      return;
    }

    if (goals.length >= 3) {
      Alert.alert("Limit reached", "You can select up to 3 goals.");
      return;
    }

    const firstMode = modeOptionsForExercise(ex)[0];
    const newGoal: GoalDraft = {
      exercise: ex,
      mode: firstMode,
      unit: MODE_UNIT[firstMode],
      start: null,
      target: 0,
    };
    setGoals([...goals, newGoal]);
  }

  function updateGoal(
    exerciseId: string,
    patch: Partial<Pick<GoalDraft, "mode" | "unit" | "start" | "target">>
  ) {
    setGoals(goals.map((g) => (g.exercise.id === exerciseId ? { ...g, ...patch } : g)));
  }

  function onChangeMode(ex: ExerciseRow, goal: GoalDraft, nextMode: GoalDraft["mode"]) {
    updateGoal(ex.id, { mode: nextMode, unit: MODE_UNIT[nextMode] });
  }

  // -------- progression helpers --------
  function roundForMode(mode: GoalDraft["mode"], n: number) {
    if (!isFinite(n)) return 0;
    return mode === "time" ? Number(n.toFixed(1)) : Math.round(n);
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

  function calcRangeForMode(mode: GoalDraft["mode"], start: number, weeks: number) {
    return mode === "time" ? decreaseRange(start, weeks, mode) : increaseRange(start, weeks, mode);
  }

  function fmtForMode(mode: GoalDraft["mode"], n: number) {
    return mode === "time" ? n.toFixed(1) : String(Math.round(n));
  }

  // Filter list (search + tab)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return deduped.filter(({ exercise }) => {
      const nameOk = q.length === 0 || exercise.name.toLowerCase().includes(q);

      const t = exercise.type ?? "strength";
      const tabOk =
        tab === "all" ||
        (tab === "cardio" ? t === "cardio" : t !== "cardio"); // strength tab = everything non-cardio

      return nameOk && tabOk;
    });
  }, [deduped, query, tab]);

  // Validation for Continue
  const hasAtLeastOneGoal = goals.length >= 1;
  const allGoalsFilled = goals.every((g) => g.start != null && g.start !== 0 && g.target != null && g.target !== 0);
  const canContinue = hasAtLeastOneGoal && allGoalsFilled;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={layout.hitSlop} style={s.headerIconBtn}>
          <Text style={s.headerIcon}>‹</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => Alert.alert("Goals", "Pick up to 3 goal exercises to track during your plan.")}
          hitSlop={layout.hitSlop}
          style={s.headerIconBtn}
        >
          <Text style={s.help}>?</Text>
        </Pressable>
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <Text style={s.progressKicker}>SETUP PROGRESS</Text>
        <View style={s.progressBarTrack}>
          <View style={[s.progressBarFill, { width: "75%" }]} />
        </View>
        <Text style={s.progressMeta}>Step 3 of 4</Text>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.md,
          paddingBottom: 140,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.h1}>Pick goals</Text>
        <Text style={s.subTitle}>Define specific targets for your key exercises.</Text>

        {/* Search */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises..."
            placeholderTextColor={colors.textMuted}
            style={s.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={layout.hitSlop}>
              <Text style={s.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Tabs */}
        <View style={s.tabsRow}>
          <Chip label="Strength" active={tab === "strength"} onPress={() => setTab("strength")} s={s} />
          <Chip label="Cardio" active={tab === "cardio"} onPress={() => setTab("cardio")} s={s} />
          <Chip label="All" active={tab === "all"} onPress={() => setTab("all")} s={s} />
        </View>

        {/* Selected goals */}
        <Text style={s.sectionTitle}>SELECTED EXERCISES</Text>

        {goals.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No goals selected</Text>
            <Text style={s.emptyText}>Select 1–3 exercises below to set targets.</Text>
          </View>
        ) : (
          <View style={{ gap: layout.space.sm }}>
            {goals.map((g) => {
              const modes = modeOptionsForExercise(g.exercise);
              const selectedContext = findWorkoutTitlesForExercise(workouts, g.exercise.id);

              return (
                <View key={g.exercise.id} style={s.goalCard}>
                  <View style={s.goalHeader}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={s.goalName} numberOfLines={1}>
                        {g.exercise.name}
                      </Text>
                      <Text style={s.goalMeta} numberOfLines={1}>
                        {selectedContext || "—"}
                      </Text>
                    </View>

                    <Pressable onPress={() => toggleExercise(g.exercise)} hitSlop={layout.hitSlop}>
                      <Text style={s.removeText}>✕</Text>
                    </Pressable>
                  </View>

                  {/* Mode toggle */}
                  <View style={s.modeRow}>
                    {modes.map((m) => {
                      const active = g.mode === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => onChangeMode(g.exercise, g, m)}
                          style={[s.modePill, active && s.modePillActive]}
                        >
                          <Text style={[s.modeText, active && s.modeTextActive]}>
                            {labelForMode(m)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Inputs */}
                  <View style={s.valueRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fieldLabel}>Start</Text>
                      <TextInput
                        style={s.valueInput}
                        placeholder="0"
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
                            updateGoal(g.exercise.id, {
                              start: val,
                              unit: MODE_UNIT[g.mode],
                            });
                          }
                        }}
                      />
                    </View>

                    <View style={s.unitPill}>
                      <Text style={s.unitText}>{MODE_UNIT[g.mode]}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={s.fieldLabel}>Target</Text>
                      <TextInput
                        style={s.valueInput}
                        placeholder="0"
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

                  {/* Recommended range */}
                  {g.start != null && planWeeks > 0 ? (
                    <Text style={s.recoText}>
                      {(() => {
                        const { min, max } = calcRangeForMode(g.mode, g.start!, planWeeks);
                        return `Recommended: ${fmtForMode(g.mode, min)}–${fmtForMode(g.mode, max)} ${MODE_UNIT[g.mode]}`;
                      })()}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Exercise list */}
        <Text style={[s.sectionTitle, { marginTop: layout.space.lg }]}>ALL EXERCISES</Text>

        <View style={{ gap: layout.space.sm }}>
          {filtered.map(({ exercise, workoutTitles }) => {
            const selected = !!findGoal(exercise.id);
            const contextText = workoutTitles.length > 0 ? workoutTitles.join(", ") : "—";

            return (
              <Pressable
                key={exercise.id}
                onPress={() => toggleExercise(exercise)}
                style={[s.pickRow, selected && s.pickRowSelected]}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.pickTitle} numberOfLines={1}>
                    {exercise.name}
                  </Text>
                  <Text style={s.pickMeta} numberOfLines={1}>
                    {contextText}
                  </Text>
                </View>

                <View style={[s.pickBadge, selected ? s.pickBadgeOn : s.pickBadgeOff]}>
                  <Text style={[s.pickBadgeText, selected && { color: "#fff" }]}>
                    {selected ? "Selected" : "Select"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom pinned CTA */}
      <View style={s.bottomDock}>
        <Pressable
          style={[s.cta, !canContinue && s.ctaDisabled]}
          disabled={!canContinue}
          onPress={() => router.push("/features/plans/create/review")}
        >
          <Text style={s.ctaText}>Continue → Review</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ---------- helpers ---------- */

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

function getWeeksBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end.getTime() - start.getTime();
  const weeks = diffMs / (1000 * 60 * 60 * 24 * 7);
  return Math.max(1, Math.round(weeks));
}

function findWorkoutTitlesForExercise(workouts: any[], exerciseId: string) {
  const titles: string[] = [];
  for (const w of workouts ?? []) {
    const hit = (w?.exercises ?? []).some((x: any) => x?.exercise?.id === exerciseId);
    if (hit) titles.push(String(w?.title ?? "Workout"));
  }
  return titles.join(", ");
}

function Chip({
  label,
  active,
  onPress,
  s,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  s: any;
}) {
  return (
    <Pressable onPress={onPress} style={[s.tabChip, active && s.tabChipActive]}>
      <Text style={[s.tabChipText, active && s.tabChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- styles ---------- */

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
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
      color: colors.primary,
      fontSize: 26,
      fontFamily: typography.fontFamily.bold,
      marginTop: -2,
    },
    help: {
      color: colors.textMuted,
      fontSize: 18,
      fontFamily: typography.fontFamily.bold,
    },

    progressWrap: {
      paddingHorizontal: layout.space.lg,
      paddingBottom: layout.space.sm,
    },
    progressKicker: {
      color: colors.textMuted,
      fontSize: typography.size.meta,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 0.8,
      marginBottom: layout.space.xs,
    },
    progressBarTrack: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.trackBg,
      overflow: "hidden",
    },
    progressBarFill: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    progressMeta: {
      marginTop: layout.space.xs,
      color: colors.textMuted,
      fontSize: typography.size.meta,
      fontFamily: typography.fontFamily.medium,
      textAlign: "right",
    },

    h1: {
      color: colors.text,
      fontSize: typography.size.h1,
      lineHeight: typography.lineHeight.h1,
      fontFamily: typography.fontFamily.bold,
      letterSpacing: -0.3,
    },
    subTitle: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      fontFamily: typography.fontFamily.medium,
    },

    searchWrap: {
      marginTop: layout.space.md,
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: layout.space.md,
      paddingVertical: 12,
    },
    searchIcon: {
      color: colors.textMuted,
      fontSize: 16,
      fontFamily: typography.fontFamily.bold,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      fontFamily: typography.fontFamily.medium,
    },
    clear: {
      color: colors.textMuted,
      fontSize: 14,
      fontFamily: typography.fontFamily.bold,
    },

    tabsRow: {
      marginTop: layout.space.md,
      flexDirection: "row",
      gap: layout.space.sm,
    },
    tabChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    tabChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabChipText: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
    },
    tabChipTextActive: {
      color: colors.onPrimary,
    },

    sectionTitle: {
      marginTop: layout.space.md,
      marginBottom: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 0.8,
    },

    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: layout.space.md,
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
    },

    goalCard: {
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: layout.space.md,
    },
    goalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: layout.space.sm,
    },
    goalName: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
    },
    goalMeta: {
      marginTop: 2,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
    },
    removeText: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.bold,
      fontSize: 16,
    },

    modeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: layout.space.sm,
    },
    modePill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    modePillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modeText: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
    },
    modeTextActive: {
      color: colors.onPrimary,
    },

    valueRow: {
      marginTop: layout.space.sm,
      flexDirection: "row",
      gap: layout.space.sm,
      alignItems: "flex-end",
    },
    fieldLabel: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      marginBottom: 6,
    },
    valueInput: {
      backgroundColor: colors.bg,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
    },
    unitPill: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: layout.radius.pill,
      backgroundColor: colors.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 2,
    },
    unitText: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
    },
    recoText: {
      marginTop: layout.space.sm,
      color: colors.primary,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
    },

    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.md,
      paddingVertical: 12,
      paddingHorizontal: layout.space.md,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    pickRowSelected: {
      borderColor: colors.primary,
    },
    pickTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
    },
    pickMeta: {
      marginTop: 2,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
    },
    pickBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: layout.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 90,
    },
    pickBadgeOff: {
      backgroundColor: colors.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    pickBadgeOn: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    pickBadgeText: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
    },

    bottomDock: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: layout.space.lg,
      paddingBottom: layout.space.lg,
      paddingTop: layout.space.sm,
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
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
    },
  });
