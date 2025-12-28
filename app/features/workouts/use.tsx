// app/features/workouts/use.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/authContext";
import { useAppTheme } from "../../../lib/useAppTheme";

/* ---------- Types ---------- */
type Muscle = { name: string | null };
type ExerciseMuscle = { contribution: number | null; muscles: Muscle | null };

type Exercise = {
  id: string;
  name: string | null;
  equipment: string | null;
  type: string | null;
  level: string | null;
  instructions: string | null;
  video_url: string | null;
  exercise_muscles: ExerciseMuscle[];
};

type WorkoutExercise = {
  id: string;
  order_index: number | null;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_time_seconds: number | null;
  target_distance: number | null;
  notes: string | null;
  exercises: Exercise | null;
};

type Workout = {
  id: string;
  title: string | null;
  notes: string | null;
  workout_exercises: WorkoutExercise[];
};

/* ---------- Helpers ---------- */
const formatTargets = (we: WorkoutExercise): string | null => {
  // Strength style (sets x reps • weight)
  if (we.target_sets || we.target_reps || we.target_weight != null) {
    const sets = we.target_sets ? `${we.target_sets} sets` : null;
    const reps = we.target_reps != null ? `${we.target_reps}` : null;
    const weight = we.target_weight != null ? `${we.target_weight}kg` : null;

    const left = [sets, reps ? `× ${reps}` : null].filter(Boolean).join(" ");
    const right = weight ? ` • ${weight}` : "";
    return `${left}${right}`.trim();
  }

  // Cardio style (time / distance)
  const time =
    we.target_time_seconds != null
      ? `${Math.round(we.target_time_seconds / 60)} min`
      : null;
  const dist = we.target_distance != null ? `${we.target_distance} km` : null;

  const line = [time, dist].filter(Boolean).join(" • ");
  return line || null;
};

function InfoIcon({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>i</Text>
    </View>
  );
}

/* ---------- Header with Edit ---------- */
function HeaderBar({ title, onEdit }: { title: string; onEdit?: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.headerBar}>
      {/* Back */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.headerSide}
      >
        <Text style={[styles.backArrow, { color: colors.text }]}>‹</Text>
      </Pressable>

      {/* Title */}
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* Edit button on right */}
      <View style={styles.headerSide}>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            style={[
              styles.headerEditButton,
              { backgroundColor: colors.warnBg, borderColor: colors.warnText },
            ]}
          >
            <Text
              style={{
                color: colors.warnText,
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              Edit
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ---------- Exercise Info Modal ---------- */
function ExerciseInfoModal({
  visible,
  onClose,
  exercise,
}: {
  visible: boolean;
  onClose: () => void;
  exercise: Exercise | null;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!exercise) return null;

  const muscles =
    exercise.exercise_muscles
      ?.map((em) =>
        em.muscles?.name
          ? `${em.muscles.name}${
              em.contribution ? ` (${em.contribution}%)` : ""
            }`
          : null
      )
      .filter(Boolean)
      .join(", ") || "—";

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCenteredCard}>
          {/* Header */}
          <Text style={styles.h2}>{exercise.name ?? "Exercise"}</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>
            {exercise.type ? `${exercise.type} • ` : ""}
            {exercise.level ?? ""}
            {exercise.equipment ? ` • ${exercise.equipment}` : ""}
          </Text>

          {/* Body */}
          <View style={{ height: 12 }} />

          <Text style={[styles.h3, { marginBottom: 6 }]}>Muscles</Text>
          <Text style={styles.body}>{muscles}</Text>

          <View style={{ height: 12 }} />

          <Text style={[styles.h3, { marginBottom: 6 }]}>How to perform</Text>
          <Text style={styles.body}>
            {exercise.instructions?.trim() || "No instructions yet."}
          </Text>

          {/* Video link */}
          {exercise.video_url ? (
            <>
              <View style={{ height: 16 }} />
              <Pressable
                onPress={() => Linking.openURL(exercise.video_url!)}
                style={[styles.pill, { backgroundColor: colors.primaryBg }]}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  Watch Video
                </Text>
              </Pressable>
            </>
          ) : null}

          {/* Close */}
          <View style={{ height: 16 }} />
          <Pressable onPress={onClose} style={[styles.pill, styles.modalClose]}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Screen ---------- */
export default function WorkoutUseScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { session } = useAuth();
  const userId = session?.user?.id || null;

  const params = useLocalSearchParams<{
    workoutId?: string;
    planWorkoutId?: string;
  }>();

  const workoutId = params.workoutId;
  const planWorkoutId =
    typeof params.planWorkoutId === "string" ? params.planWorkoutId : undefined;

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [infoTarget, setInfoTarget] = useState<Exercise | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const openInfo = (ex: Exercise | null) => {
    setInfoTarget(ex);
    setInfoOpen(true);
  };

  const load = useCallback(async () => {
    if (!userId || !workoutId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          `
          id, title, notes,
          workout_exercises(
            id, order_index, target_sets, target_reps, target_weight,
            target_time_seconds, target_distance, notes,
            exercises (
              id, name, equipment, type, level, instructions, video_url,
              exercise_muscles (
                contribution,
                muscles ( name )
              )
            )
          )
        `
        )
        .eq("id", workoutId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      const normalized: Workout | null = data
        ? {
            id: String(data.id),
            title: data.title ?? null,
            notes: data.notes ?? null,
            workout_exercises: (data.workout_exercises ?? [])
              .map((we: any) => ({
                id: String(we.id),
                order_index: we.order_index ?? null,
                target_sets: we.target_sets ?? null,
                target_reps: we.target_reps ?? null,
                target_weight:
                  we.target_weight != null ? Number(we.target_weight) : null,
                target_time_seconds: we.target_time_seconds ?? null,
                target_distance:
                  we.target_distance != null
                    ? Number(we.target_distance)
                    : null,
                notes: we.notes ?? null,
                exercises: we.exercises
                  ? {
                      id: String(we.exercises.id),
                      name: we.exercises.name ?? null,
                      equipment: we.exercises.equipment ?? null,
                      type: we.exercises.type ?? null,
                      level: we.exercises.level ?? null,
                      instructions: we.exercises.instructions ?? null,
                      video_url: we.exercises.video_url ?? null,
                      exercise_muscles: (
                        we.exercises.exercise_muscles ?? []
                      ).map((em: any) => ({
                        contribution: em.contribution ?? null,
                        muscles: em.muscles
                          ? { name: em.muscles.name ?? null }
                          : null,
                      })),
                    }
                  : null,
              }))
              .sort(
                (a: WorkoutExercise, b: WorkoutExercise) =>
                  (a.order_index ?? 0) - (b.order_index ?? 0)
              ),
          }
        : null;

      setWorkout(normalized);
    } catch (e) {
      console.warn("workout use load error:", e);
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }, [userId, workoutId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!userId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Please log in.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Workout not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar
        title={workout.title ?? "Workout"}
        onEdit={() =>
          router.push({
            pathname: "/features/workouts/edit",
            params: { workoutId: workout.id },
          })
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 16 }}
      >
        {/* Workout notes */}
        {workout.notes?.trim() ? (
          <View style={styles.card}>
            <Text style={styles.h3}>Workout Notes</Text>
            <Text style={styles.muted}>{workout.notes.trim()}</Text>
          </View>
        ) : null}

        {/* Exercises */}
        <View style={{ gap: 12 }}>
          <Text style={styles.h2}>
            Exercises ({workout.workout_exercises.length})
          </Text>

          {workout.workout_exercises.map((we) => {
            const ex = we.exercises;
            const targets = formatTargets(we);
            return (
              <View key={we.id} style={styles.exerciseCard}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.h3}>{ex?.name ?? "Exercise"}</Text>
                    {targets ? (
                      <Text style={styles.subtle}>{targets}</Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => openInfo(ex)}>
                    <InfoIcon color={colors.subtle} />
                  </Pressable>
                </View>

                {we.notes?.trim() ? (
                  <Text style={[styles.muted, { marginTop: 6 }]}>
                    {we.notes.trim()}
                  </Text>
                ) : null}
              </View>
            );
          })}

          {workout.workout_exercises.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.muted}>
                No exercises in this workout yet.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky footer: Start Workout */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/features/workouts/start",
              params: { workoutId: workout.id, planWorkoutId },
            })
          }
          style={[styles.startBtn, { backgroundColor: "#22c55e" }]}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>
            ▶ Start Workout
          </Text>
        </Pressable>
      </View>

      <ExerciseInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        exercise={infoTarget}
      />
    </SafeAreaView>
  );
}

/* ---------- themed styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    exerciseCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    title: { fontSize: 20, fontWeight: "900", color: colors.text },
    h2: { fontSize: 16, fontWeight: "800", color: colors.text },
    h3: { fontSize: 15, fontWeight: "700", color: colors.text },
    muted: { color: colors.subtle },
    subtle: { color: colors.subtle },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 10,
      backgroundColor: colors.background,
      padding: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
    },

    startBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 999,
    },

    pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
    modalClose: { backgroundColor: colors.surface },

    body: { color: colors.text, lineHeight: 20 },

    /* Header */
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerSide: {
      width: 64,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    backArrow: { fontSize: 28, fontWeight: "600", marginRight: 4 },
    headerCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      height: 44,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },
    headerEditButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999, // “more oblong than round”
      borderWidth: StyleSheet.hairlineWidth,
    },

    /* Modal */
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modalCenteredCard: {
      width: "90%",
      maxHeight: "80%",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
  });
