// app/features/workouts/screens/WorkoutOverview.tsx
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuth } from "@/lib/authContext";
import { router, useLocalSearchParams } from "expo-router";

import {
  Card,
  Button,
  Pill,
  WorkoutCover,
  ListRow,
  Icon,
  ModalSheet,
  Screen,
  ScreenHeader,
  BackButton,
} from "@/ui";
import { useLiveWorkout } from "../hooks/useLiveWorkout";
import { SafeAreaView } from "react-native-safe-area-context";

function formatLastDone(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function formatE1rm(n: number | null) {
  if (n == null) return null;
  const v = Math.round(Number(n));
  return `${v} kg e1RM`;
}

function formatKg(n: number | null) {
  if (n == null) return null;
  const v = Math.round(Number(n));
  return `${v.toLocaleString()} kg`;
}

export default function WorkoutOverviewScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const params = useLocalSearchParams<{
    workoutId?: string;
    planWorkoutId?: string;
  }>();

  const workoutId = params.workoutId ?? null;
  const planWorkoutId = params.planWorkoutId ?? null;

  const { colors, typography, layout } = useAppTheme();

  const { loading, error, bootstrap, headerChips, hadSavedDraft, createDraft } =
    useLiveWorkout({
      userId,
      workoutId,
      planWorkoutId,
    });

  const [exerciseModalOpen, setExerciseModalOpen] = React.useState(false);
  const [activeExerciseId, setActiveExerciseId] = React.useState<string | null>(
    null
  );

  const ex = React.useMemo(() => {
    if (!bootstrap) return [];
    return bootstrap.exercises
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [bootstrap]);

  const activeExercise = React.useMemo(() => {
    if (!bootstrap || !activeExerciseId) return null;
    return (
      bootstrap.exercises.find((x) => x.exerciseId === activeExerciseId) ?? null
    );
  }, [bootstrap, activeExerciseId]);

  const isPlanWorkout = !!bootstrap?.workout.isPlanWorkout;

  const onPressStartOrContinue = React.useCallback(async () => {
    if (!bootstrap) return;

    // ensure a draft exists before entering live flow
    await createDraft();

    // TODO: adjust route to your live workout screen path
    router.push({
      pathname: "/features/workouts/live",
      params: {
        workoutId: bootstrap.workout.workoutId,
        planWorkoutId: bootstrap.workout.planWorkoutId ?? undefined,
      },
    });
  }, [bootstrap, createDraft]);

  const onPressEdit = React.useCallback(() => {
    if (!bootstrap) return;
    // TODO: adjust route to your workout editor
    router.push({
      pathname: "/features/workouts/edit",
      params: { workoutId: bootstrap.workout.workoutId },
    });
  }, [bootstrap]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          padding: layout.space.lg,
        }}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.medium,
          }}
        >
          Loading…
        </Text>
      </View>
    );
  }

  if (error || !bootstrap) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          padding: layout.space.lg,
        }}
      >
        <Text
          style={{
            color: colors.danger,
            fontFamily: typography.fontFamily.semibold,
          }}
        >
          {error ?? "Failed to load workout."}
        </Text>
        <View style={{ height: layout.space.md }} />
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView>
          <ScrollView
            contentContainerStyle={{
              padding: layout.space.lg,
              paddingBottom: 110, // space for bottom CTA
              gap: layout.space.md,
            }}
          >
            {/* Banner */}
            <Card>
              <View style={{ gap: layout.space.md }}>
                <WorkoutCover
                  imageKey={bootstrap.workout.imageKey}
                  title={null}
                  subtitle={null}
                  height={190}
                  radius={layout.radius.xl}
                  badge={
                    isPlanWorkout ? (
                      <Pill
                        label="Active Plan"
                        tone="primary"
                        variant="inverted"
                        // if you later add "inverted" tone to Pill, set it here
                      />
                    ) : null
                  }
                  badgePosition="topLeft"
                >
                  {/* top-right action */}
                  {!isPlanWorkout ? (
                    <Pressable
                      onPress={onPressEdit}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: layout.radius.pill,
                        backgroundColor: "rgba(0,0,0,0.35)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Icon name="create-outline" size={16} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: typography.fontFamily.semibold,
                          fontSize: typography.size.meta,
                        }}
                      >
                        Edit
                      </Text>
                    </Pressable>
                  ) : null}
                </WorkoutCover>

                {/* Title + notes */}
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: layout.space.lg,
                      paddingTop: layout.space.md,
                      paddingBottom: layout.space.md,
                    }}
                  >
                    {/* Left */}
                    <View style={{ width: 44, alignItems: "flex-start" }}>
                      <BackButton />
                    </View>

                    {/* Center */}
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontFamily: typography.fontFamily.bold,
                        fontSize: typography.size.h1,
                        lineHeight: typography.lineHeight.h1,
                        color: colors.text,
                        letterSpacing: -0.3,
                        paddingHorizontal: layout.space.sm,
                      }}
                    >
                      {bootstrap.workout.title}
                    </Text>

                    {/* Right spacer (keeps title perfectly centered) */}
                    <View style={{ width: 44 }} />
                  </View>

                  {bootstrap.workout.notes ? (
                    <Text
                      style={{
                        fontFamily: typography.fontFamily.regular,
                        fontSize: typography.size.body,
                        lineHeight: typography.lineHeight.body,
                        color: colors.textMuted,
                      }}
                    >
                      {bootstrap.workout.notes}
                    </Text>
                  ) : null}
                </View>

                {/* Header chips */}
                {headerChips.length ? (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: layout.space.sm,
                    }}
                  >
                    {headerChips.map((c) => (
                      <View
                        key={c.label}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: layout.radius.lg,
                          minWidth: 120,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: typography.fontFamily.medium,
                            fontSize: typography.size.meta,
                            color: colors.textMuted,
                          }}
                        >
                          {c.label}
                        </Text>
                        <Text
                          style={{
                            fontFamily: typography.fontFamily.semibold,
                            fontSize: typography.size.sub,
                            color: colors.text,
                            marginTop: 2,
                          }}
                        >
                          {c.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Card>

            {/* Goals (plan only) */}
            {bootstrap.goals.length ? (
              <Card>
                <View style={{ gap: layout.space.sm }}>
                  <Text
                    style={{
                      fontFamily: typography.fontFamily.semibold,
                      fontSize: typography.size.h3,
                      lineHeight: typography.lineHeight.h3,
                      color: colors.text,
                    }}
                  >
                    Today’s Goal
                  </Text>

                  {bootstrap.goals.map((g) => (
                    <View
                      key={g.id}
                      style={{
                        padding: layout.space.md,
                        borderRadius: layout.radius.lg,
                        backgroundColor: colors.trackBg,
                        borderWidth: 1,
                        borderColor: colors.trackBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: typography.fontFamily.semibold,
                          color: colors.text,
                        }}
                      >
                        {g.type} • {g.targetNumber}
                        {g.unit ? ` ${g.unit}` : ""}
                      </Text>
                      {g.notes ? (
                        <Text style={{ marginTop: 4, color: colors.textMuted }}>
                          {g.notes}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {/* Exercise list */}
            <View style={{ gap: layout.space.sm }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontFamily: typography.fontFamily.bold,
                    fontSize: typography.size.h2,
                    lineHeight: typography.lineHeight.h2,
                    color: colors.text,
                  }}
                >
                  Routine
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontFamily: typography.fontFamily.medium,
                  }}
                >
                  {ex.length} exercises
                </Text>
              </View>

              <View style={{ gap: layout.space.sm }}>
                {ex.map((e, idx) => {
                  const last = formatLastDone(e.lastSession.completedAt);
                  const e1rm = formatE1rm(e.bestE1rm);
                  const vol = formatKg(e.totalVolumeAllTime);

                  const subtitleParts = [
                    e.equipment ? e.equipment : null,
                    last ? `Last: ${last}` : null,
                    e1rm ? e1rm : null,
                  ].filter(Boolean);

                  return (
                    <ListRow
                      key={e.exerciseId}
                      title={`${idx + 1}. ${e.name}`}
                      subtitle={subtitleParts.join(" • ")}
                      rightNode={
                        vol ? (
                          <Text
                            style={{
                              fontFamily: typography.fontFamily.medium,
                              fontSize: typography.size.meta,
                              color: colors.textMuted,
                            }}
                          >
                            {vol}
                          </Text>
                        ) : undefined
                      }
                      onPress={() => {
                        setActiveExerciseId(e.exerciseId);
                        setExerciseModalOpen(true);
                      }}
                    />
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Bottom CTA */}
          <View
            style={{
              position: "absolute",
              left: layout.space.lg,
              right: layout.space.lg,
              bottom: layout.space.lg,
            }}
          >
            <Button
              title={hadSavedDraft ? "Continue workout" : "Start workout"}
              onPress={onPressStartOrContinue}
            />
          </View>

          {/* Exercise Modal */}
          <ModalSheet
            visible={exerciseModalOpen}
            onClose={() => setExerciseModalOpen(false)}
            title={activeExercise?.name ?? "Exercise"}
          >
            {!activeExercise ? null : (
              <View style={{ gap: layout.space.md }}>
                {/* quick meta */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: layout.space.sm,
                  }}
                >
                  {activeExercise.equipment ? (
                    <Pill label={activeExercise.equipment} tone="neutral" />
                  ) : null}
                  {activeExercise.level ? (
                    <Pill label={activeExercise.level} tone="neutral" />
                  ) : null}
                  {activeExercise.prescription?.targetSets ? (
                    <Pill
                      label={`${activeExercise.prescription.targetSets} sets`}
                      tone="primary"
                    />
                  ) : null}
                  {activeExercise.prescription?.targetReps ? (
                    <Pill
                      label={`${activeExercise.prescription.targetReps} reps`}
                      tone="primary"
                    />
                  ) : null}
                </View>

                {/* instructions */}
                {activeExercise.instructions ? (
                  <Text
                    style={{
                      color: colors.textMuted,
                      lineHeight: typography.lineHeight.body,
                    }}
                  >
                    {activeExercise.instructions}
                  </Text>
                ) : null}

                {/* last session */}
                <Card>
                  <View style={{ gap: layout.space.sm }}>
                    <Text
                      style={{
                        fontFamily: typography.fontFamily.semibold,
                        color: colors.text,
                      }}
                    >
                      Last session
                    </Text>
                    <Text style={{ color: colors.textMuted }}>
                      {activeExercise.lastSession.completedAt
                        ? `Completed: ${formatLastDone(
                            activeExercise.lastSession.completedAt
                          )}`
                        : "No history yet"}
                    </Text>

                    {activeExercise.lastSession.sets?.length ? (
                      <View style={{ gap: 8 }}>
                        {activeExercise.lastSession.sets
                          .slice(0, 6)
                          .map((s) => (
                            <View
                              key={`${s.setNumber}-${s.dropIndex}`}
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                paddingVertical: 8,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                              }}
                            >
                              <Text
                                style={{ color: colors.text }}
                              >{`Set ${s.setNumber}`}</Text>
                              <Text style={{ color: colors.textMuted }}>
                                {s.weight != null && s.reps != null
                                  ? `${s.weight} × ${s.reps}`
                                  : s.timeSeconds != null
                                  ? `${s.timeSeconds}s`
                                  : s.distance != null
                                  ? `${s.distance}`
                                  : "-"}
                              </Text>
                            </View>
                          ))}
                      </View>
                    ) : null}
                  </View>
                </Card>

                <Button
                  title="Start this exercise"
                  onPress={async () => {
                    setExerciseModalOpen(false);
                    await createDraft();
                    // TODO: route into your exercise-live modal/screen with this exercise selected
                    router.push({
                      pathname: "/features/workouts/live",
                      params: {
                        workoutId: bootstrap.workout.workoutId,
                        planWorkoutId:
                          bootstrap.workout.planWorkoutId ?? undefined,
                        exerciseId: activeExercise.exerciseId,
                      },
                    });
                  }}
                />
              </View>
            )}
          </ModalSheet>
        </SafeAreaView>
      </View>
    </>
  );
}
