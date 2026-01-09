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
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/authContext";
import { useAppTheme } from "../../../../lib/useAppTheme";

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

  // ✅ needed for superset/dropset UI
  superset_group: string | null;
  superset_index: number | null;
  is_dropset: boolean | null;

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

type HistorySetRow = {
  exercise_id: string;
  workout_history_id: string | null;
  reps: number | null;
  weight: number | null;
  created_at?: string | null; // or performed_at if you have it
};

const epley1RM = (weight: number, reps: number) => {
  // reps <= 1 => basically weight
  if (!weight || !reps) return 0;
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
};

const formatHistoryTargets = (
  setsCount: number,
  bestReps: number,
  bestWeight: number
) => `${setsCount} sets × ${bestReps} reps • ${bestWeight}kg`;

/* ---------- Helpers ---------- */
const formatTargets = (we: WorkoutExercise): string | null => {
  if (we.target_sets || we.target_reps || we.target_weight != null) {
    const sets = we.target_sets ? `${we.target_sets} sets` : null;
    const reps = we.target_reps != null ? `${we.target_reps} reps` : null;
    const weight = we.target_weight != null ? `${we.target_weight}kg` : null;

    const left = [sets, reps ? `× ${reps}` : null].filter(Boolean).join(" ");
    const right = weight ? ` • ${weight}` : "";
    return `${left}${right}`.trim();
  }

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
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.headerSide}
      >
        <Text style={[styles.backArrow, { color: colors.text }]}>‹</Text>
      </Pressable>

      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

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
          <Text style={styles.h2}>{exercise.name ?? "Exercise"}</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>
            {exercise.type ? `${exercise.type} • ` : ""}
            {exercise.level ?? ""}
            {exercise.equipment ? ` • ${exercise.equipment}` : ""}
          </Text>

          <View style={{ height: 12 }} />

          <Text style={[styles.h3, { marginBottom: 6 }]}>Muscles</Text>
          <Text style={styles.body}>{muscles}</Text>

          <View style={{ height: 12 }} />

          <Text style={[styles.h3, { marginBottom: 6 }]}>How to perform</Text>
          <Text style={styles.body}>
            {exercise.instructions?.trim() || "No instructions yet."}
          </Text>

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

          <View style={{ height: 16 }} />
          <Pressable onPress={onClose} style={[styles.pill, styles.modalClose]}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Superset UI helpers ---------- */
const SUPERSET_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#22c55e", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
];

const hashToIndex = (s: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
};

const supersetColorFor = (groupId: string, fallbackPrimary?: string) => {
  const c = SUPERSET_COLORS[hashToIndex(groupId, SUPERSET_COLORS.length)];
  return c || fallbackPrimary || "#3b82f6";
};

type DisplayItem =
  | { kind: "single"; key: string; we: WorkoutExercise }
  | {
      kind: "superset";
      key: string;
      groupId: string;
      items: WorkoutExercise[];
    };

// assumes list already sorted by order_index
const buildDisplayItems = (arr: WorkoutExercise[]): DisplayItem[] => {
  const out: DisplayItem[] = [];

  for (let i = 0; i < arr.length; i++) {
    const we = arr[i];
    const gid = we.superset_group;

    if (!gid) {
      out.push({ kind: "single", key: `we:${we.id}`, we });
      continue;
    }

    const prev = i > 0 ? arr[i - 1] : null;
    const isStart = !prev || prev.superset_group !== gid;
    if (!isStart) continue;

    const items: WorkoutExercise[] = [];
    let j = i;
    while (j < arr.length && arr[j].superset_group === gid) {
      items.push(arr[j]);
      j++;
    }

    // order within block by superset_index (fallback to order_index)
    items.sort((a, b) => {
      const ai =
        a.superset_index != null ? a.superset_index : a.order_index ?? 0;
      const bi =
        b.superset_index != null ? b.superset_index : b.order_index ?? 0;
      return ai - bi;
    });

    out.push({
      kind: "superset",
      key: `ss:${gid}:${items[0]?.id ?? i}`,
      groupId: gid,
      items,
    });
  }

  return out;
};

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
  const [historyTargetsByExerciseId, setHistoryTargetsByExerciseId] = useState<
    Record<string, string>
  >({});

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
            id,
            order_index,
            superset_group,
            superset_index,
            is_dropset,
            target_sets,
            target_reps,
            target_weight,
            target_time_seconds,
            target_distance,
            notes,
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

                superset_group: we.superset_group ?? null,
                superset_index: we.superset_index ?? null,
                is_dropset: we.is_dropset ?? false,

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

      // build exercise id list
      const exerciseIds = Array.from(
        new Set(
          (normalized?.workout_exercises ?? [])
            .map((we) => we.exercises?.id)
            .filter(Boolean) as string[]
        )
      );

      // default empty if none
      if (!exerciseIds.length) {
        setHistoryTargetsByExerciseId({});
        return;
      }

      const { data: summaries, error: sumErr } = await supabase.rpc(
        "get_last_exercise_session_summaries",
        { p_user_id: userId, p_exercise_ids: exerciseIds }
      );

      if (sumErr) {
        console.warn("[historyTargets rpc] failed", sumErr);
        setHistoryTargetsByExerciseId({});
      } else {
        const map: Record<string, string> = {};
        (summaries ?? []).forEach((r: any) => {
          if (!r.exercise_id) return;

          // be defensive: allow 0 sets but still show if reps/weight exist
          const setsCount = Number(r.sets_count ?? 0);
          const bestReps = r.best_reps != null ? Number(r.best_reps) : null;
          const bestWeight =
            r.best_weight != null ? Number(r.best_weight) : null;

          if (bestReps == null || bestWeight == null) return;

          map[String(r.exercise_id)] = formatHistoryTargets(
            setsCount,
            bestReps,
            bestWeight
          );
        });

        setHistoryTargetsByExerciseId(map);
      }
    } catch (e) {
      console.warn("workout use load error:", e);
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }, [userId, workoutId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const displayItems = useMemo(
    () => buildDisplayItems(workout?.workout_exercises ?? []),
    [workout?.workout_exercises]
  );

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

  const DROP_ORANGE = "#f97316";

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
        {workout.notes?.trim() ? (
          <View style={styles.card}>
            <Text style={styles.h3}>Workout Notes</Text>
            <Text style={styles.muted}>{workout.notes.trim()}</Text>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text style={styles.h2}>
            Exercises ({workout.workout_exercises.length})
          </Text>

          {/* ✅ grouped rendering (same as view.tsx) */}
          {displayItems.map((it) => {
            if (it.kind === "single") {
              return (
                <ExerciseCard
                  key={it.key}
                  we={it.we}
                  outlineColor={null}
                  openInfo={openInfo}
                />
              );
            }

            const outline = supersetColorFor(it.groupId, colors.primary);

            return (
              <View key={it.key} style={{ marginTop: 2 }}>
                <View
                  style={{
                    borderWidth: 2,
                    borderColor: outline,
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  {it.items.map((we, idx) => (
                    <ExerciseCard
                      key={we.id}
                      we={we}
                      outlineColor={outline}
                      openInfo={openInfo}
                      noOuterCardBorder
                      isFirst={idx === 0}
                      isLast={idx === it.items.length - 1}
                      dropOrange={DROP_ORANGE}
                    />
                  ))}
                </View>
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

  function ExerciseCard({
    we,
    outlineColor,
    openInfo,
    noOuterCardBorder,
    isFirst,
    isLast,
    dropOrange,
  }: {
    we: WorkoutExercise;
    outlineColor: string | null;
    openInfo: (ex: Exercise | null) => void;
    noOuterCardBorder?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
    dropOrange?: string;
  }) {
    const ex = we.exercises;

    const DROP = dropOrange ?? "#f97316";

    const exId = ex?.id ?? null;
    const targets =
      (exId ? historyTargetsByExerciseId[exId] : null) ?? formatTargets(we);

    return (
      <View
        style={[
          styles.exerciseCard,
          noOuterCardBorder && { borderWidth: 0, borderRadius: 0 },
          noOuterCardBorder &&
            isFirst && { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
          noOuterCardBorder &&
            isLast && {
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
            },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Text style={styles.h3}>{ex?.name ?? "Exercise"}</Text>

              {/* Superset badge */}
              {we.superset_group ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: outlineColor ?? colors.primary,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "900",
                      color: outlineColor ?? colors.primary,
                    }}
                  >
                    Superset
                  </Text>
                </View>
              ) : null}

              {/* Dropset badge (orange) */}
              {we.is_dropset ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: DROP,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text
                    style={{ fontSize: 11, fontWeight: "900", color: DROP }}
                  >
                    Dropset
                  </Text>
                </View>
              ) : null}
            </View>

            {targets ? <Text style={styles.subtle}>{targets}</Text> : null}
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
  }
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
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },

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
