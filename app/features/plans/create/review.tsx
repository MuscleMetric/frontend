// app/_features/plans/create/Review.tsx
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { usePlanDraft } from "./store";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/useAuth";

function humanDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function Review() {
  const { session, loading } = useAuth();
  const userId = session?.user?.id;

  const {
    title,
    endDate,
    workoutsPerWeek,
    workouts,
    goals,
    reset,
  } = usePlanDraft();

  const [saving, setSaving] = useState(false);

  // Basic validation before allowing save
  const canSave = useMemo(() => {
    if (!title?.trim()) return false;
    if (!endDate) return false;
    if (!workouts || workouts.length !== workoutsPerWeek) return false;
    if (workouts.some(w => !w.title?.trim() || w.exercises.length === 0)) return false;
    return true;
  }, [title, endDate, workoutsPerWeek, workouts]);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      Alert.alert("Please log in", "You must be signed in to create a plan.");
      router.replace("/(auth)/login");
    }
  }, [loading, userId]);

  async function handleCreate() {
    if (!userId) return;
    if (!canSave) {
      Alert.alert("Incomplete", "Please complete all required fields before creating the plan.");
      return;
    }

    try {
      setSaving(true);

      // 1) Create plan
      const startIso = new Date().toISOString().slice(0, 10);
      const { data: planRow, error: planErr } = await supabase
        .from("plans")
        .insert({
          user_id: userId,
          title,
          start_date: startIso,
          end_date: endDate,
          is_completed: false,
        })
        .select("id")
        .single();
      if (planErr) throw planErr;
      const planId: string = planRow!.id;

      // 2) Create workouts (in same order as drafts)
      const workoutInsert = workouts.map((w) => ({
        user_id: userId,
        title: w.title,
        notes: null,
      }));
      const { data: createdWorkouts, error: wErr } = await supabase
        .from("workouts")
        .insert(workoutInsert)
        .select("id, title, created_at");
      if (wErr) throw wErr;

      const workoutIds = createdWorkouts!.map((w) => w.id as string);

      // 3) plan_workouts (order + highlights)
      const planWorkoutInsert = workouts.map((w, idx) => ({
        plan_id: planId,
        workout_id: workoutIds[idx],
        title: w.title,
        weekly_complete: false,
        order_index: idx,
        highlights: w.exercises.slice(0, 4).map((e) => e.exercise.name).join(", "),
      }));
      const { error: pwErr } = await supabase.from("plan_workouts").insert(planWorkoutInsert);
      if (pwErr) throw pwErr;

      // 4) workout_exercises (targets)
      const wexInsert = workouts.flatMap((w, idx) =>
        w.exercises.map((e) => ({
          workout_id: workoutIds[idx],
          exercise_id: e.exercise.id,
          order_index: e.order_index,
          target_sets: e.target_sets ?? null,
          target_reps: e.target_reps ?? null,
          target_weight: e.target_weight ?? null,
          target_time_seconds: e.target_time_seconds ?? null,
          target_distance: e.target_distance ?? null,
          notes: e.notes ?? null,
        }))
      );
      if (wexInsert.length) {
        const { error: wexErr } = await supabase.from("workout_exercises").insert(wexInsert);
        if (wexErr) throw wexErr;
      }

      // 5) goals (optional). Store starting value in notes JSON.
      if (goals.length) {
        const gInsert = goals.map((g) => ({
          user_id: userId,
          plan_id: planId,
          exercise_id: g.exercise.id,
          type: g.mode, // enum goal_type
          target_number: g.target,
          unit: g.unit ?? null,
          deadline: endDate,
          is_active: true,
          notes: g.start != null ? JSON.stringify({ start: g.start }) : null,
        }));
        const { error: gErr } = await supabase.from("goals").insert(gInsert);
        if (gErr) throw gErr;
      }

      Alert.alert("Plan created", "Your plan has been saved.");
      reset(); // clear draft
      router.replace("/(tabs)/workout");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Could not create plan", e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !userId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F7F8FA" }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <View style={styles.card}>
        <Text style={styles.h2}>Review Plan</Text>
        <Text style={styles.muted}>
          Make sure everything looks right before creating your plan.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.h3}>{title || "Untitled Plan"}</Text>
        <Text style={styles.muted}>
          Ends {humanDate(endDate)} • {workoutsPerWeek} workouts/week
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h3}>Workouts</Text>
        <View style={{ height: 8 }} />
        {workouts.map((w, i) => (
          <View key={i} style={styles.subCard}>
            <Text style={styles.h4}>
              {i + 1}. {w.title || "Untitled Workout"}
            </Text>
            {w.exercises.length === 0 ? (
              <Text style={styles.muted}>No exercises yet.</Text>
            ) : (
              <View style={{ marginTop: 4, gap: 2 }}>
                {w.exercises.map((e, j) => (
                  <Text key={`${i}-${j}`} style={styles.muted}>
                    • {e.exercise.name}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h3}>Goals</Text>
        <View style={{ height: 8 }} />
        {goals.length === 0 ? (
          <Text style={styles.muted}>No goals selected.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {goals.map((g, i) => (
              <Text key={i} style={styles.muted}>
                • {g.exercise.name} — {g.mode.replace("_", " ")} → {g.target}
                {g.unit ? ` ${g.unit}` : ""}{g.start != null ? `  (start ${g.start}${g.unit ?? ""})` : ""}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable style={[styles.btn]} onPress={() => router.back()}>
          <Text style={styles.btnText}>← Back</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.primary, { flex: 1 }]}
          onPress={handleCreate}
          disabled={!canSave || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: "white", fontWeight: "800" }]}>
              Create Plan
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  subCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },

  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },

  h2: { fontSize: 18, fontWeight: "800" },
  h3: { fontSize: 16, fontWeight: "800" },
  h4: { fontSize: 14, fontWeight: "700" },
  muted: { color: "#6b7280" },

  btn: {
    backgroundColor: "#EEF2F6",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
  },
  btnText: { fontWeight: "700", color: "#111827" },
  primary: { backgroundColor: "#2563eb" },
});
