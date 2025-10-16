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
import { usePlanDraft, type ExerciseRow, type GoalDraft } from "./store";

const MODES = [
  { key: "exercise_weight", label: "Weight" },
  { key: "exercise_reps", label: "Reps" },
  { key: "distance", label: "Distance" },
  { key: "time", label: "Time" },
] as const;

export default function Goals() {
  const { workouts, goals, setGoals } = usePlanDraft();

  // Flatten all exercises across workouts with the workout title for context
  const allExercises = useMemo(
    () =>
      workouts.flatMap((w) =>
        w.exercises.map((e) => ({
          workoutTitle: w.title,
          exercise: e.exercise as ExerciseRow,
        }))
      ),
    [workouts]
  );

  const findGoal = (exerciseId: string) =>
    goals.find((g) => g.exercise.id === exerciseId);

  function toggleExercise(ex: ExerciseRow, workoutTitle: string) {
    const exists = findGoal(ex.id);
    if (exists) {
      // remove the goal
      setGoals(goals.filter((g) => g.exercise.id !== ex.id));
      return;
    }
    if (goals.length >= 3) {
      Alert.alert("Limit reached", "You can select up to 3 goals.");
      return;
    }
    // add a new goal with sensible defaults
    const newGoal: GoalDraft = {
      exercise: ex,
      mode: "exercise_weight",
      unit: guessUnitForExercise(ex), // heuristic
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
      goals.map((g) =>
        g.exercise.id === exerciseId ? { ...g, ...patch } : g
      )
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F7F8FA" }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={s.h2}>Set Your Plan Goals</Text>
      <Text style={s.muted}>Select up to 3 exercises to track.</Text>

      <View style={{ height: 12 }} />

      {allExercises.map(({ exercise, workoutTitle }) => {
        const selected = !!findGoal(exercise.id);
        const g = findGoal(exercise.id);
        return (
          <View
            key={exercise.id}
            style={[s.card, selected && { borderColor: "#2563eb" }]}
          >
            <Pressable
              onPress={() => toggleExercise(exercise, workoutTitle)}
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <View>
                <Text style={s.h4}>{exercise.name}</Text>
                <Text style={s.muted}>{workoutTitle}</Text>
              </View>
              <Text style={[s.badge, selected ? s.badgeOn : s.badgeOff]}>
                {selected ? "Selected" : "Select"}
              </Text>
            </Pressable>

            {selected && g && (
              <View style={{ marginTop: 10, gap: 10 }}>
                {/* Mode selector */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {MODES.map((m) => {
                    const active = g.mode === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        onPress={() => {
                          const nextUnit =
                            g.unit ?? defaultUnitForMode(m.key as GoalDraft["mode"]);
                          updateGoal(exercise.id, {
                            mode: m.key as GoalDraft["mode"],
                            unit: nextUnit,
                          });
                        }}
                        style={[s.chip, active && s.chipActive]}
                      >
                        <Text style={{ color: active ? "#fff" : "#111827", fontWeight: "700" }}>
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Values */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Start"
                    keyboardType="numeric"
                    value={g.start != null ? String(g.start) : ""}
                    onChangeText={(v) =>
                      updateGoal(exercise.id, {
                        start: v === "" ? null : Number(v),
                      })
                    }
                  />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Target"
                    keyboardType="numeric"
                    value={g.target != null ? String(g.target) : ""}
                    onChangeText={(v) =>
                      updateGoal(exercise.id, {
                        target: v === "" ? 0 : Number(v),
                      })
                    }
                  />
                  <TextInput
                    style={[s.input, { width: 90 }]}
                    placeholder="Unit"
                    value={g.unit ?? ""}
                    onChangeText={(v) => updateGoal(exercise.id, { unit: v })}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}

      <View style={{ height: 8 }} />

      <Pressable
        style={[s.btn, s.primary]}
        onPress={() => router.push("/features/plans/create/review")}
      >
        <Text style={[s.btnText, { color: "#fff" }]}>Next → Review Plan</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ------------- helpers ------------- */

function guessUnitForExercise(ex: ExerciseRow): string | undefined {
  // Simple heuristic; tailor this to your exercise catalog if you want.
  if (ex.type === "cardio") return "min";
  if (ex.type === "mobility") return "reps";
  return "kg"; // default for strength
}

function defaultUnitForMode(mode: GoalDraft["mode"]) {
  switch (mode) {
    case "exercise_weight":
      return "kg";
    case "exercise_reps":
      return "reps";
    case "distance":
      return "km";
    case "time":
      return "min";
  }
}

/* ------------- styles ------------- */

const s = StyleSheet.create({
  h2: { fontSize: 18, fontWeight: "800" },
  h4: { fontSize: 15, fontWeight: "700" },
  muted: { color: "#6b7280" },

  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: "800",
    overflow: "hidden",
  },
  badgeOn: { backgroundColor: "#dbeafe", color: "#1e40af" },
  badgeOff: { backgroundColor: "#f3f4f6", color: "#111827" },

  chip: {
    backgroundColor: "#EEF2F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "#2563eb" },

  input: {
    backgroundColor: "white",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  btn: {
    backgroundColor: "#EEF2F6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  primary: { backgroundColor: "#2563eb" },
  btnText: { fontWeight: "800", color: "#111827" },
});
