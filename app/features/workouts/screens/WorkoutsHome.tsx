import React, { useCallback, useState } from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabase";

import {
  Screen,
  ScreenHeader,
  LoadingScreen,
  ErrorState,
  EmptyState,
  AuthRequiredState,
  ProgressBar,
  Pill,
  Card,
  ListRow,
  Button,
  WorkoutCover,
} from "@/ui";

/* ---------- Types (RPC payload) ---------- */
type WorkoutsTabPayload = {
  state: "new_user" | "no_plan" | "with_plan";

  setup?: {
    title: string;
    subtitle: string;
    progressPct: number;
    cta: { label: string; action: "create_first_workout" };
  };

  suggested?: {
    title: string;
    seeAll: boolean;
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string;
      previewText: string;
      tapAction: "preview";
    }>;
  };

  myWorkouts: {
    title: string;
    seeAll: boolean;
    emptyState?: {
      title: string;
      subtitle: string;
      ctaPrimary: { label: string; action: "create_workout" };
      ctaSecondary?: { label: string; action: "explore_plans" };
    };
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string;
      exerciseCount: number;
      previewText: string;
      lastDoneAt: string | null;
    }>;
  };

  activePlan?: {
    planId: string;
    title: string;
    progress: { completedCount: number; totalCount: number; pct: number };
    nextWorkout: {
      planWorkoutId: string;
      workoutId: string;
      title: string;
      imageKey: string;
    } | null;
    primaryCta: { label: string; action: "start_workout" };
  };

  planSchedule?: {
    title: string;
    actions: { viewAll: boolean; edit: boolean };
    items: Array<{
      planWorkoutId: string;
      workoutId: string;
      title: string;
      orderIndex: number | null;
      weeklyComplete: boolean;
      imageKey: string;
      previewText: string;
    }>;
  };

  optionalSessions?: {
    title: string;
    actionCreate: boolean;
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string;
      previewText: string;
      lastDoneAt: string | null;
    }>;
  };
};

/* ---------- Helpers ---------- */
function lastDoneLabel(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function EmptyStateWithSecondary({
  title,
  message,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  message: string;
  ctaLabel: string;
  onCta: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View>
      <EmptyState
        title={title}
        message={message}
        ctaLabel={ctaLabel}
        onCta={onCta}
      />
      {secondaryLabel && onSecondary ? (
        <View style={{ marginTop: 10 }}>
          <Button
            variant="secondary"
            title={secondaryLabel}
            onPress={onSecondary}
          />
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Create Modal ---------- */
function WorkoutCreateOptionsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Button
            title="Generate a workout for me"
            onPress={() => {
              onClose();
              router.push("/features/workouts/create/auto-create");
            }}
          />
          <View style={{ height: 10 }} />
          <Button
            variant="secondary"
            title="Build my own workout"
            onPress={() => {
              onClose();
              router.push("/features/workouts/create");
            }}
          />
          <View style={{ height: 12 }} />
          <Button variant="ghost" title="Cancel" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function WorkoutsHome() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<WorkoutsTabPayload | null>(null);

  const [showCreateOptions, setShowCreateOptions] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase.rpc("get_workouts_tab_payload");
      if (error) throw error;
      setPayload(data as WorkoutsTabPayload);
    } catch (e: any) {
      setPayload(null);
      setErr(e?.message ?? "Failed to load workouts.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!userId) return <AuthRequiredState />;
  if (loading) return <LoadingScreen />;
  if (err || !payload)
    return (
      <ErrorState
        title="Couldn’t load Workouts"
        message={err ?? ""}
        onRetry={load}
      />
    );

  return (
    <Screen>

      {payload.state === "new_user" && (
        <View style={styles.stack}>
          {/* Setup Hero */}
          <Card>
            <View style={{ gap: 10 }}>
              <Pill label="New" />
              <ListRow
                title={payload.setup?.title ?? "Let’s build your first workout"}
                subtitle={payload.setup?.subtitle ?? ""}
                showChevron={false}
              />
              <ProgressBar valuePct={payload.setup?.progressPct ?? 0} />
              <View style={styles.row}>
                <Button
                  title={payload.setup?.cta.label ?? "Create First Workout"}
                  onPress={() => setShowCreateOptions(true)}
                />
                <Button
                  variant="secondary"
                  title="Create a plan"
                  onPress={() => router.push("/features/plans/create/planInfo")}
                />
              </View>
            </View>
          </Card>

          {/* Suggested */}
          {payload.suggested?.items?.length ? (
            <View style={styles.section}>
              <ListRow title={payload.suggested.title} showChevron={false} />
              <View style={{ gap: 10 }}>
                {payload.suggested.items.map((it) => (
                  <ListRow
                    key={it.workoutId}
                    title={it.title}
                    subtitle={it.previewText}
                    rightText="Preview"
                    left={
                      <WorkoutCover
                        imageKey={it.imageKey}
                        height={56}
                        radius={14}
                      />
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/features/workouts/view",
                        params: { workoutId: it.workoutId },
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* My Workouts empty */}
          {payload.myWorkouts.items.length === 0 &&
          payload.myWorkouts.emptyState ? (
            <EmptyStateWithSecondary
              title={payload.myWorkouts.emptyState.title}
              message={payload.myWorkouts.emptyState.subtitle}
              ctaLabel={payload.myWorkouts.emptyState.ctaPrimary.label}
              onCta={() => setShowCreateOptions(true)}
              secondaryLabel={payload.myWorkouts.emptyState.ctaSecondary?.label}
              onSecondary={() => router.push("/features/plans/create/planInfo")}
            />
          ) : null}
        </View>
      )}

      {payload.state === "no_plan" && (
        <View style={styles.stack}>
          <View style={styles.rowBetween}>
            <ListRow title={payload.myWorkouts.title} showChevron={false} />
            <Button
              variant="secondary"
              title="Create workout"
              onPress={() => setShowCreateOptions(true)}
            />
          </View>

          {payload.myWorkouts.items.length === 0 &&
          payload.myWorkouts.emptyState ? (
            <EmptyStateWithSecondary
              title={payload.myWorkouts.emptyState.title}
              message={payload.myWorkouts.emptyState.subtitle}
              ctaLabel={payload.myWorkouts.emptyState.ctaPrimary.label}
              onCta={() => setShowCreateOptions(true)}
              secondaryLabel={payload.myWorkouts.emptyState.ctaSecondary?.label}
              onSecondary={() => router.push("/features/plans/create/planInfo")}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {payload.myWorkouts.items.map((w) => (
                <ListRow
                  key={w.workoutId}
                  title={w.title}
                  subtitle={w.previewText}
                  rightText={lastDoneLabel(w.lastDoneAt)}
                  left={
                    <WorkoutCover
                      imageKey={w.imageKey}
                      height={56}
                      radius={14}
                    />
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/features/workouts/use",
                      params: { workoutId: w.workoutId },
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>
      )}

      {payload.state === "with_plan" && payload.activePlan && (
        <View style={styles.stack}>
          {/* Active Plan Hero */}
          <Card>
            <View style={{ gap: 10 }}>
              <ListRow
                title={payload.activePlan.title}
                subtitle={`${payload.activePlan.progress.completedCount} / ${payload.activePlan.progress.totalCount} complete`}
                showChevron={false}
              />
              <ProgressBar valuePct={payload.activePlan.progress.pct} />

              <View style={styles.rowBetween}>
                <Button
                  title={payload.activePlan.primaryCta.label}
                  disabled={!payload.activePlan.nextWorkout}
                  onPress={() => {
                    const nw = payload.activePlan?.nextWorkout;
                    if (!nw) return;
                    router.push({
                      pathname: "/features/workouts/view",
                      params: {
                        workoutId: nw.workoutId,
                        planWorkoutId: nw.planWorkoutId,
                      },
                    });
                  }}
                />
                <Button
                  variant="secondary"
                  title="View plan"
                  onPress={() =>
                    router.push({
                      pathname: "/features/plans/view",
                      params: { planId: payload.activePlan!.planId },
                    })
                  }
                />
              </View>
            </View>
          </Card>

          {/* Plan Schedule */}
          {payload.planSchedule ? (
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <ListRow
                  title={payload.planSchedule.title}
                  showChevron={false}
                />
                <Button
                  variant="ghost"
                  title="Edit"
                  onPress={() =>
                    router.push({
                      pathname: "/features/plans/edit",
                      params: { planId: payload.activePlan!.planId },
                    })
                  }
                />
              </View>

              <View style={{ gap: 10 }}>
                {payload.planSchedule.items.map((pw) => (
                  <ListRow
                    key={pw.planWorkoutId}
                    title={pw.title}
                    subtitle={pw.previewText}
                    rightText={pw.weeklyComplete ? "✓" : "Next"}
                    left={
                      <WorkoutCover
                        imageKey={pw.imageKey}
                        height={56}
                        radius={14}
                      />
                    }
                    onPress={() => {
                      if (pw.weeklyComplete) return;
                      router.push({
                        pathname: "/features/workouts/view",
                        params: {
                          workoutId: pw.workoutId,
                          planWorkoutId: pw.planWorkoutId,
                        },
                      });
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Optional Sessions */}
          {payload.optionalSessions?.items?.length ? (
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <ListRow
                  title={payload.optionalSessions.title}
                  showChevron={false}
                />
                <Button
                  variant="secondary"
                  title="Create workout"
                  onPress={() => setShowCreateOptions(true)}
                />
              </View>

              <View style={{ gap: 10 }}>
                {payload.optionalSessions.items.map((w) => (
                  <ListRow
                    key={w.workoutId}
                    title={w.title}
                    subtitle={w.previewText}
                    rightText={lastDoneLabel(w.lastDoneAt)}
                    left={
                      <WorkoutCover
                        imageKey={w.imageKey}
                        height={56}
                        radius={14}
                      />
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/features/workouts/use",
                        params: { workoutId: w.workoutId },
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}

      <WorkoutCreateOptionsModal
        visible={showCreateOptions}
        onClose={() => setShowCreateOptions(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  section: { gap: 10 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
  },
});
