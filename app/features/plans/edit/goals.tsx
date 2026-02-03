// app/features/plans/edit/goals.tsx
import React, { useMemo, useState, useEffect } from "react";
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

import { useAppTheme } from "../../../../lib/useAppTheme";
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
  return t === "cardio" ? ["distance", "time"] : ["exercise_weight", "exercise_reps"];
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

function calcRangeForMode(mode: GoalDraft["mode"], start: number, weeks: number) {
  // time goals typically aim to decrease
  return mode === "time" ? decreaseRange(start, weeks, mode) : increaseRange(start, weeks, mode);
}

export default function EditGoals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { workouts, goals: storeGoals, setGoals, endDate } = useEditPlan();

  // Local buffer so we can Cancel without mutating store
  const [localGoals, setLocalGoals] = useState<GoalDraft[]>(storeGoals ?? []);

  useEffect(() => {
    setLocalGoals(storeGoals ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only once on mount; store is source-of-truth when entering

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
    const newGoal: GoalDraft = {
      id: null, // new goal
      exercise: ex,
      mode: firstMode,
      unit: MODE_UNIT[firstMode],
      start: null,
      target: 0,
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
    updateGoal(ex.id, { mode: nextMode, unit: MODE_UNIT[nextMode] });
  }

  function onSave() {
    // Guard: 0..3 goals is allowed? your create flow requires 1..3, but edit can be 0..3.
    if (localGoals.length > 3) {
      Alert.alert("Too many goals", "You can select up to 3 goals.");
      return;
    }
    // Normalize numbers
    const cleaned = localGoals.map((g) => ({
      ...g,
      start: g.start == null ? null : Number(g.start),
      target: Number(g.target ?? 0),
      unit: g.unit ?? MODE_UNIT[g.mode],
    }));
    setGoals(cleaned);
    router.back();
  }

  const footerH = 86 + insets.bottom;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: footerH + 16 }}
      >
        <Text style={s.h2}>Edit Goals</Text>
        <Text style={s.muted}>
          Pick up to 3 exercises from your plan to track.
        </Text>

        <View style={{ height: 12 }} />

        {deduped.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No exercises in this plan yet</Text>
            <Text style={s.emptySub}>
              Add exercises to your workouts first, then come back to set goals.
            </Text>
          </View>
        ) : (
          deduped.map(({ exercise, workoutTitles }) => {
            const selected = !!findGoal(exercise.id);
            const g = findGoal(exercise.id);
            const contextText =
              workoutTitles.length > 0 ? workoutTitles.join(", ") : "—";
            const modes = modeOptionsForExercise(exercise);

            return (
              <View
                key={exercise.id}
                style={[s.card, selected && { borderColor: colors.primary }]}
              >
                <Pressable
                  onPress={() => toggleExercise(exercise)}
                  style={{ flexDirection: "row", justifyContent: "space-between" }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.h4}>{exercise.name}</Text>
                    <Text style={s.muted}>{contextText}</Text>
                  </View>

                  <Text style={[s.badge, selected ? s.badgeOn : s.badgeOff]}>
                    {selected ? "Selected" : "Select"}
                  </Text>
                </Pressable>

                {selected && g && (
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {/* Mode selector */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {modes.map((m) => {
                        const active = g.mode === m;
                        return (
                          <Pressable
                            key={m}
                            onPress={() => onChangeMode(exercise, g, m)}
                            style={[s.chip, active && s.chipActive]}
                          >
                            <Text
                              style={{
                                color: active ? (colors.onPrimary ?? "#fff") : colors.text,
                                fontWeight: "800",
                              }}
                            >
                              {labelForMode(m)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Values */}
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={s.input}
                          placeholder="Start"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          value={g.start != null ? String(g.start) : ""}
                          onChangeText={(v) => {
                            const raw = v === "" ? null : Number(v);
                            const val = raw == null ? null : roundForMode(g.mode, raw);

                            if (val != null && planWeeks > 0) {
                              const { suggested } = calcRangeForMode(g.mode, val, planWeeks);
                              updateGoal(exercise.id, {
                                start: val,
                                target: suggested,
                                unit: MODE_UNIT[g.mode],
                              });
                            } else {
                              updateGoal(exercise.id, {
                                start: val,
                                unit: MODE_UNIT[g.mode],
                              });
                            }
                          }}
                        />
                      </View>

                      <Text style={s.unitPill}>{MODE_UNIT[g.mode]}</Text>

                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={s.input}
                          placeholder="Target"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          value={g.target != null ? String(g.target) : ""}
                          onChangeText={(v) => {
                            const raw = v === "" ? 0 : Number(v);
                            const val = roundForMode(g.mode, raw);
                            updateGoal(exercise.id, {
                              target: val,
                              unit: MODE_UNIT[g.mode],
                            });
                          }}
                        />
                      </View>
                    </View>

                    {/* Recommended range */}
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
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}

        {deduped.length > 0 ? (
          <Text style={s.hint}>
            {localGoals.length}/3 goals selected
            {isDirty ? " • Unsaved changes" : ""}
          </Text>
        ) : null}
      </ScrollView>

      {/* Sticky footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={s.footerBtn} onPress={() => router.back()}>
          <Text style={s.footerText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[s.footerBtn, s.primaryBtn, !isDirty && { opacity: 0.55 }]}
          onPress={onSave}
          disabled={!isDirty}
        >
          <Text style={s.primaryText}>Save goals</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* -------- themed styles -------- */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    h2: { fontSize: 18, fontWeight: "900", color: colors.text },
    h4: { fontSize: 15, fontWeight: "800", color: colors.text },
    muted: { color: colors.textMuted ?? colors.subtle },

    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 10,
    },

    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 15 },
    emptySub: { color: colors.textMuted ?? colors.subtle, marginTop: 6, fontWeight: "600" },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      fontWeight: "900",
      overflow: "hidden",
    },
    badgeOn: { backgroundColor: colors.primary, color: colors.onPrimary ?? "#fff" },
    badgeOff: { backgroundColor: colors.surface, color: colors.text },

    chip: {
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    input: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      color: colors.text,
      fontWeight: "800",
    },

    unitPill: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surface,
      color: colors.text,
      fontWeight: "900",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    recoText: {
      color: colors.text,
      fontWeight: "700",
    },

    hint: {
      marginTop: 6,
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "800",
    },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.bg,
    },

    footerBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    footerText: {
      fontWeight: "900",
      color: colors.text,
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    primaryText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "900",
    },
  });
