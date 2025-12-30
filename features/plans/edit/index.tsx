// app/features/plans/edit/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  Platform,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";
import {
  useEditPlan,
  type WorkoutDraft,
  type ExerciseRow,
  type GoalDraft,
} from "./store";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export default function EditPlan() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const {
    initFromLoaded,
    title,
    startDate,
    endDate,
    workouts,
    goals,
    addWorkout,
    removeWorkout,
    setMeta,
  } = useEditPlan();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // date picker
  const [showEnd, setShowEnd] = useState(false);
  const [tmpEnd, setTmpEnd] = useState(new Date());

  useEffect(() => {
    if (!userId || !planId) return;
    (async () => {
      try {
        setLoading(true);

        // Plan
        const { data: p } = await supabase
          .from("plans")
          .select("id, title, start_date, end_date")
          .eq("id", planId)
          .eq("user_id", userId)
          .maybeSingle();

        // Plan workouts + nested exercises
        const { data: pws } = await supabase
          .from("plan_workouts")
          .select(
            `
    id, title, order_index, workout_id,
    workouts!inner (
      id, title,
      workout_exercises (
        id, order_index, superset_group, is_dropset, is_archived,
        exercises ( id, name, type )
      )
    )
  `
          )
          .eq("plan_id", planId)
          .eq("is_archived", false)
          .order("order_index");

        // Normalize -> WorkoutDraft[]
        const workoutDrafts: WorkoutDraft[] = (pws ?? []).map((row: any) => {
          const w = Array.isArray(row.workouts)
            ? row.workouts[0]
            : row.workouts;
          const exs = (w?.workout_exercises ?? [])
            .slice()
            .sort(
              (a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)
            )
            .map((we: any, i: number) => ({
              id: String(we.id ?? ""), // <-- keep id
              exercise: {
                id: String(we.exercises?.id ?? ""),
                name: we.exercises?.name ?? "Exercise",
                type: we.exercises?.type ?? null,
              } as ExerciseRow,
              order_index: i,
              supersetGroup: we?.superset_group ?? null,
              isDropset: !!we?.is_dropset,
            }));
          return {
            id: String(row.id ?? ""), // <-- keep id
            title: row.title ?? w?.title ?? "Workout",
            exercises: exs,
          };
        });

        // Goals
        const { data: g } = await supabase
          .from("goals")
          .select(
            `id, type, target_number, unit, notes, exercises ( id, name, type )`
          )
          .eq("plan_id", planId)
          .eq("user_id", userId)
          .order("created_at");

        const goalDrafts: GoalDraft[] = (g ?? []).map((r: any) => ({
          id: String(r.id),
          exercise: {
            id: String(r.exercises?.id ?? ""),
            name: r.exercises?.name ?? "Exercise",
            type: r.exercises?.type ?? null,
          },
          mode: r.type,
          unit: r.unit,
          start: safeStartFromNotes(r.notes),
          target: Number(r.target_number) || 0,
        }));

        initFromLoaded({
          planId,
          title: p?.title ?? "Plan",
          startDate: p?.start_date ?? null,
          endDate: p?.end_date ?? null,
          workouts: workoutDrafts,
          goals: goalDrafts,
        });

        if (p?.end_date) setTmpEnd(new Date(p.end_date));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, planId]);

  async function saveAll() {
    if (!userId || !planId) return;
    try {
      setSaving(true);

      const payload = {
        p_plan_id: planId,
        p_user_id: userId,
        p_title: title,
        p_end_date: endDate,
        // when building payload
        p_workouts: workouts.map((w, wIdx) => ({
          id: w.id ?? null,
          title: w.title,
          order_index: wIdx, // optional; supported by RPC
          exercises: w.exercises.map((e, idx) => ({
            id: e.id ?? null,
            exerciseId: e.exercise.id,
            order_index: idx,
            supersetGroup: e.supersetGroup ?? null, // RPC stores as text
            isDropset: !!e.isDropset,
          })),
        })),

        p_goals: goals.map((g) => ({
          id: g.id ?? null,  
          exerciseId: g.exercise.id,
          mode: g.mode,
          target: g.target,
          unit: g.unit,
          start: g.start,
        })),
      };

      const { error } = await supabase.rpc("update_full_plan", payload);
      if (error) throw error;

      router.back(); // return to previous screen
    } catch (e: any) {
      console.error("saveAll error:", e);
      alert(e?.message ?? "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!userId || loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      {/* Meta card */}
      <View style={s.card}>
        <Text style={s.h2}>Plan Information</Text>
        <Text style={s.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={(t) => setMeta({ title: t })}
          placeholder="Plan title"
          style={s.input}
          placeholderTextColor={colors.subtle}
        />

        <Text style={[s.label, { marginTop: 12 }]}>End date</Text>
        <Pressable
          style={[s.input, { justifyContent: "center" }]}
          onPress={() => setShowEnd(true)}
        >
          <Text style={{ color: colors.text }}>
            {endDate ? fmtDate(endDate) : "Select end date"}
          </Text>
        </Pressable>
      </View>

      {/* Workouts list */}
      <View style={s.card}>
        <Text style={s.h3}>Workouts</Text>
        <View style={{ height: 8 }} />

        {workouts.map((w, i) => (
          <View
            key={i}
            style={[s.row, { flexDirection: "row", alignItems: "center" }]}
          >
            <Pressable
              style={{ flex: 1 }}
              onPress={() =>
                router.push({
                  pathname: "/features/plans/edit/workout",
                  params: { index: i },
                })
              }
            >
              <Text style={s.rowTitle}>
                {i + 1}. {w.title || "Workout"}
              </Text>
              <Text style={s.muted}>
                {w.exercises.length} exercise
                {w.exercises.length === 1 ? "" : "s"}
              </Text>
            </Pressable>

            {/* Delete action */}
            <Pressable
              onPress={() => {
                Alert.alert(
                  "Delete workout?",
                  `Remove “${w.title || "Workout"}” from this plan?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => removeWorkout(i),
                    },
                  ]
                );
              }}
              hitSlop={10}
              style={{ paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ color: colors.danger, fontWeight: "700" }}>
                Delete
              </Text>
            </Pressable>
          </View>
        ))}

        {/* Add another workout */}
        <Pressable
          style={[s.btn, s.primary, { marginTop: 12 }]}
          onPress={() => {
            const newIndex = addWorkout(); // returns index of newly added workout
            router.push({
              pathname: "/features/plans/edit/workout",
              params: { index: newIndex },
            });
          }}
        >
          <Text style={s.btnPrimaryText}>＋ Add Workout</Text>
        </Pressable>
      </View>

      {/* Goals */}
      <View style={s.card}>
        <Text style={s.h3}>Goals</Text>

        {/* Goals list */}
        {goals.length === 0 ? (
          <Text style={[s.muted, { marginTop: 6 }]}>No goals yet.</Text>
        ) : (
          <View style={{ gap: 6, marginTop: 8 }}>
            {goals.map((g, i) => (
              <Text key={i} style={s.muted}>
                • {g.exercise.name} — {g.mode.replace("_", " ")} → {g.target}
                {g.unit ? ` ${g.unit}` : ""}
                {g.start != null ? `  (start ${g.start}${g.unit ?? ""})` : ""}
              </Text>
            ))}
          </View>
        )}

        {/* Edit button below list */}
        <Pressable
          style={[s.btn, s.primary, { marginTop: 12 }]}
          onPress={() => router.push("/features/plans/edit/goals")}
        >
          <Text style={s.btnPrimaryText}>Edit Goals</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable style={s.btn} onPress={() => router.back()}>
          <Text style={s.btnText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[s.btn, s.primary, { flex: 1, opacity: saving ? 0.6 : 1 }]}
          disabled={saving}
          onPress={saveAll}
        >
          <Text style={s.btnPrimaryText}>
            {saving ? "Saving…" : "Save Changes"}
          </Text>
        </Pressable>
      </View>

      {/* End date modal */}
      <Modal
        visible={showEnd}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEnd(false)}
      >
        <View style={s.modalScrim}>
          <View style={s.modalCard}>
            <Text style={s.h3}>Select End Date</Text>
            <DateTimePicker
              value={tmpEnd}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              onChange={(_, d) => d && setTmpEnd(d)}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable style={s.btn} onPress={() => setShowEnd(false)}>
                <Text style={s.btnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.btn, s.primary]}
                onPress={() => {
                  const yyyy_mm_dd = new Date(
                    tmpEnd.getTime() - tmpEnd.getTimezoneOffset() * 60000
                  )
                    .toISOString()
                    .slice(0, 10);
                  setMeta({ endDate: yyyy_mm_dd });
                  setShowEnd(false);
                }}
              >
                <Text style={s.btnPrimaryText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function safeStartFromNotes(notes?: string | null) {
  if (!notes) return null;
  try {
    const obj = JSON.parse(notes);
    return typeof obj?.start === "number" ? obj.start : null;
  } catch {
    return null;
  }
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    h2: { fontSize: 18, fontWeight: "800", color: colors.text },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    label: {
      fontWeight: "700",
      color: colors.text,
      marginTop: 6,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 8,
    },
    rowTitle: { fontWeight: "800", color: colors.text, marginBottom: 2 },
    muted: { color: colors.subtle },
    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: { fontWeight: "700", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "800" },
    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
