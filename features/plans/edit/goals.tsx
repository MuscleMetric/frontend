// app/features/plans/create/goals.tsx
import React, { useMemo } from "react";
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
import { useEditPlan, type ExerciseRow, type GoalDraft } from "./store";
import { useAppTheme } from "../../../../lib/useAppTheme";

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

export default function Goals() {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { workouts, goals, setGoals, endDate } = useEditPlan();

  // Plan length (weeks)
  const todayIso = new Date().toISOString().slice(0, 10);
  const planWeeks = endDate ? getWeeksBetween(todayIso, endDate) : 0;

  // Build a map: exerciseId -> { exercise, workoutTitles[] } (dedup across workouts)
  const deduped: DedupExercise[] = useMemo(() => {
    const map = new Map<string, DedupExercise>();
    for (const w of workouts) {
      for (const ex of w.exercises) {
        const id = ex.exercise.id;
        if (!map.has(id)) {
          map.set(id, { exercise: ex.exercise, workoutTitles: [w.title] });
        } else {
          const entry = map.get(id)!;
          if (!entry.workoutTitles.includes(w.title))
            entry.workoutTitles.push(w.title);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.exercise.name.localeCompare(b.exercise.name)
    );
  }, [workouts]);

  const findGoal = (exerciseId: string) =>
    goals.find((g) => g.exercise.id === exerciseId);

  function modeOptionsForExercise(ex: ExerciseRow): GoalDraft["mode"][] {
    return ex.type === "cardio"
      ? ["distance", "time"]
      : ["exercise_weight", "exercise_reps"];
  }

  function toggleExercise(ex: ExerciseRow) {
    const exists = findGoal(ex.id);
    if (exists) {
      setGoals(goals.filter((g) => g.exercise.id !== ex.id));
      return;
    }
    if (goals.length >= 3) {
      Alert.alert("Limit reached", "You can select up to 3 goals.");
      return;
    }
    const firstMode = modeOptionsForExercise(ex)[0];
    const newGoal: GoalDraft = {
      id: null,
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
    setGoals(
      goals.map((g) => (g.exercise.id === exerciseId ? { ...g, ...patch } : g))
    );
  }

  function onChangeMode(
    ex: ExerciseRow,
    goal: GoalDraft,
    nextMode: GoalDraft["mode"]
  ) {
    updateGoal(ex.id, { mode: nextMode, unit: MODE_UNIT[nextMode] });
  }

  // -------- progression helpers --------
  function getWeeksBetween(startIso: string, endIso: string): number {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const diffMs = end.getTime() - start.getTime();
    const weeks = diffMs / (1000 * 60 * 60 * 24 * 7);
    return Math.max(1, Math.round(weeks));
  }
  function increaseRange(
    start: number,
    weeks: number,
    mode: GoalDraft["mode"]
  ) {
    const min = start * (1 + 0.01 * weeks);
    const max = start * (1 + 0.05 * weeks);
    const suggested = (min + max) / 2;
    return {
      min: roundForMode(mode, min),
      max: roundForMode(mode, max),
      suggested: roundForMode(mode, suggested),
    };
  }
  function decreaseRange(
    start: number,
    weeks: number,
    mode: GoalDraft["mode"]
  ) {
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
    return mode === "time"
      ? decreaseRange(start, weeks, mode)
      : increaseRange(start, weeks, mode);
  }
  function roundForMode(mode: GoalDraft["mode"], n: number) {
    if (!isFinite(n)) return 0;
    return mode === "time" ? Number(n.toFixed(1)) : Math.round(n);
  }
  function fmtForMode(mode: GoalDraft["mode"], n: number) {
    return mode === "time" ? n.toFixed(1) : String(Math.round(n));
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={s.h2}>Set Your Plan Goals</Text>
      <Text style={s.muted}>Select up to 3 exercises to track.</Text>

      <View style={{ height: 12 }} />

      {deduped.map(({ exercise, workoutTitles }) => {
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
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
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
                            color: active
                              ? colors.primary ?? "#fff"
                              : colors.text,
                            fontWeight: "700",
                          }}
                        >
                          {labelForMode(m)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Values */}
                <View
                  style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
                >
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={s.input}
                      placeholder="Start"
                      placeholderTextColor={colors.subtle}
                      keyboardType="numeric"
                      value={g.start != null ? String(g.start) : ""}
                      onChangeText={(v) => {
                        const raw = v === "" ? null : Number(v);
                        const val =
                          raw == null ? null : roundForMode(g.mode, raw);
                        if (val != null && planWeeks > 0) {
                          const { suggested } = calcRangeForMode(
                            g.mode,
                            val,
                            planWeeks
                          );
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
                      placeholderTextColor={colors.subtle}
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
                {g.start != null && planWeeks > 0 && (
                  <Text style={{ color: colors.primaryText, marginTop: 4 }}>
                    {(() => {
                      const { min, max } = calcRangeForMode(
                        g.mode,
                        g.start!,
                        planWeeks
                      );
                      return `Recommended target range: ${fmtForMode(
                        g.mode,
                        min
                      )}–${fmtForMode(g.mode, max)} ${MODE_UNIT[g.mode]}`;
                    })()}
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ height: 8 }} />

      <Pressable style={[s.btn, s.primary]} onPress={() => router.back()}>
        <Text style={s.btnPrimaryText}>Update Goals</Text>
      </Pressable>
    </ScrollView>
  );
}

/* -------- helpers -------- */

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

/* -------- themed styles -------- */

const makeStyles = (colors: any) =>
  StyleSheet.create({
    h2: { fontSize: 18, fontWeight: "800", color: colors.text },
    h4: { fontSize: 15, fontWeight: "700", color: colors.text },
    muted: { color: colors.subtle },

    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 10,
    },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      fontWeight: "800",
      overflow: "hidden",
    },
    badgeOn: { backgroundColor: colors.primaryBg, color: colors.primaryText },
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
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.text,
    },

    unitPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surface,
      color: colors.text,
      fontWeight: "700",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnText: { fontWeight: "800", color: colors.text },
    btnPrimaryText: { fontWeight: "800", color: colors.onPrimary ?? "#fff" },
  });
