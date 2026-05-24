// app/(features)/goals/components/PlanGoalsCard.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";

import {
  usePlanGoals,
  type GoalMetric,
  type GoalRow,
} from "../hooks/usePlanGoals";
import PlanGoalsGraph from "./PlanGoalsGraph";
import { useAppTheme } from "../../../../lib/useAppTheme";

type Props = { userId?: string | null };

const METRIC_LABEL: Record<GoalMetric, string> = {
  weight: "Weight",
  reps: "Reps",
  distance: "Distance",
  time: "Time",
};

const METRIC_UNIT: Record<GoalMetric, string> = {
  weight: "kg",
  reps: "reps",
  distance: "km",
  time: "sec",
};

function metricStartKey(metric: GoalMetric) {
  switch (metric) {
    case "weight":
      return "start_weight";
    case "reps":
      return "start_reps";
    case "distance":
      return "start_distance";
    case "time":
      return "start_time_seconds";
  }
}

function metricTargetKey(metric: GoalMetric) {
  switch (metric) {
    case "weight":
      return "target_weight";
    case "reps":
      return "target_reps";
    case "distance":
      return "target_distance";
    case "time":
      return "target_time_seconds";
  }
}

function positive(n: number | null | undefined) {
  return n != null && Number.isFinite(n) && n > 0;
}

function fmtMetric(metric: GoalMetric, value: number | null | undefined) {
  if (!positive(value)) return "—";

  if (metric === "weight") return `${roundToNearest(value!, 2.5)}kg`;
  if (metric === "distance") return `${Number(value!.toFixed(2))}km`;
  if (metric === "time") return `${Math.round(value!)}sec`;
  return `${Math.round(value!)}reps`;
}

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}

function goalSummary(g: GoalRow) {
  if (g.goal_summary) return g.goal_summary;

  return g.metrics
    .map((metric) => {
      const start = g[metricStartKey(metric)];
      const target = g[metricTargetKey(metric)];

      return `${METRIC_LABEL[metric]}: ${fmtMetric(metric, start)} → ${fmtMetric(
        metric,
        target,
      )}`;
    })
    .join(" • ");
}

function goalShortLabel(g: GoalRow) {
  return g.metrics.map((m) => METRIC_LABEL[m]).join(" + ");
}

function statusFromPoint(
  point: {
    goalValue: number;
    actualValue?: number | null;
  } | null,
) {
  if (!point || point.actualValue == null) return null;

  const diff = point.actualValue - point.goalValue;

  if (diff >= 5)
    return {
      label: "Above line",
      detail: `+${Math.round(diff)}% vs plan line`,
    };
  if (diff <= -5)
    return {
      label: "Below line",
      detail: `${Math.abs(Math.round(diff))}% vs plan line`,
    };
  return { label: "Near line", detail: "Close to the plan line" };
}

export default function PlanGoalsCard({ userId }: Props) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography),
    [colors, typography],
  );

  const { loading, error, plan, planTitle, goals } = usePlanGoals(userId);

  const endText = useMemo(() => {
    if (!plan?.end_date) return null;

    const d = new Date(plan.end_date);
    return isNaN(d.getTime())
      ? plan.end_date
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  }, [plan?.end_date]);

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const selectedGoal = useMemo(
    () => goals.find((g) => g.id === (selectedGoalId ?? goals[0]?.id)),
    [goals, selectedGoalId],
  );

  const [selectedPoint, setSelectedPoint] = useState<{
    date: Date;
    goalValue: number;
    actualValue?: number | null;
    workoutTitle: string | null;
    kind: "goal" | "actual";
  } | null>(null);

  useEffect(() => {
    if (goals.length && !selectedGoalId) {
      setSelectedGoalId(goals[0].id);
    }
  }, [goals, selectedGoalId]);

  const [viewMode, setViewMode] = useState<"twoWeeks" | "overall">("twoWeeks");

  useEffect(() => {
    setSelectedPoint(null);
  }, [viewMode, selectedGoalId]);

  const now = new Date();
  const selectedStatus = statusFromPoint(selectedPoint);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Plan</Text>
          <Text style={styles.h3}>Goals</Text>
        </View>

        <View style={styles.switchRow}>
          <Pressable
            onPress={() => setViewMode("twoWeeks")}
            style={[
              styles.switchBtn,
              viewMode === "twoWeeks" && styles.switchActive,
            ]}
          >
            <Text
              style={[
                styles.switchText,
                viewMode === "twoWeeks" && styles.switchActiveText,
              ]}
            >
              2 Weeks
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setViewMode("overall")}
            style={[
              styles.switchBtn,
              viewMode === "overall" && styles.switchActive,
            ]}
          >
            <Text
              style={[
                styles.switchText,
                viewMode === "overall" && styles.switchActiveText,
              ]}
            >
              Overall
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.subtle}>
        {plan
          ? `From “${planTitle}”${endText ? ` • Ends ${endText}` : ""}`
          : "No active plan"}
      </Text>

      <View style={{ height: 12 }} />

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <Text style={[styles.subtle, { color: colors.danger ?? "#e11" }]}>
          {error}
        </Text>
      ) : goals.length === 0 ? (
        <>
          <Text style={styles.subtle}>
            No plan goals yet. Create a plan with goals to see them here.
          </Text>

          <Pressable
            style={[styles.primaryBtn, { marginTop: 12 }]}
            onPress={() => router.push("/features/plans/create/planInfo")}
          >
            <Text style={styles.primaryBtnText}>Create Plan</Text>
          </Pressable>
        </>
      ) : (
        <>
          {selectedGoal ? (
            <View style={styles.focusCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.focusTitle}>
                  {selectedGoal.exercises?.name ?? "Goal exercise"}
                </Text>
                <Text style={styles.focusMeta}>
                  {goalSummary(selectedGoal)}
                </Text>
              </View>

              <View style={styles.focusPill}>
                <Text style={styles.focusPillText}>
                  {goalShortLabel(selectedGoal)}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.graphShell}>
            {plan && selectedGoal ? (
              <>
                <PlanGoalsGraph
                  plan={plan}
                  goal={selectedGoal}
                  viewMode={viewMode}
                  userId={userId}
                  onPointPress={({
                    date,
                    goalValue,
                    actualValue,
                    workoutTitle,
                    kind,
                  }) => {
                    setSelectedPoint({
                      date,
                      goalValue,
                      actualValue: actualValue ?? null,
                      workoutTitle,
                      kind,
                    });
                  }}
                />

                {selectedPoint && viewMode === "twoWeeks"
                  ? (() => {
                      const isFuture =
                        selectedPoint.date.getTime() >
                        now.getTime() + 60 * 1000;

                      if (isFuture) {
                        return (
                          <View
                            style={[
                              styles.pointBubble,
                              styles.pointBubbleFuture,
                            ]}
                          >
                            <View style={styles.pointBubbleHeaderRow}>
                              <Text style={styles.pointBubbleTitle}>
                                {selectedPoint.workoutTitle || "Workout"}
                              </Text>

                              <View style={styles.plannedPill}>
                                <Text style={styles.plannedPillText}>
                                  Planned
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.pointBubbleDate}>
                              {selectedPoint.date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </Text>

                            <Text style={styles.pointBubbleGoal}>
                              Plan line: {Math.round(selectedPoint.goalValue)}%
                            </Text>
                          </View>
                        );
                      }

                      return (
                        <View style={styles.pointBubble}>
                          <View style={styles.pointBubbleRow}>
                            <View style={styles.pointBubbleLeft}>
                              <Text style={styles.pointBubbleTitle}>
                                {selectedPoint.workoutTitle || "Workout"}
                              </Text>
                              <Text style={styles.pointBubbleDate}>
                                {selectedPoint.date.toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </Text>
                            </View>

                            <View style={styles.pointBubbleRight}>
                              <Text style={styles.pointBubbleActual}>
                                {selectedPoint.actualValue != null
                                  ? `${Math.round(selectedPoint.actualValue)}%`
                                  : "—"}
                              </Text>
                              <Text style={styles.pointBubbleGoal}>
                                Plan line: {Math.round(selectedPoint.goalValue)}
                                %
                              </Text>
                            </View>
                          </View>

                          {selectedStatus ? (
                            <View style={styles.statusRow}>
                              <Text style={styles.statusLabel}>
                                {selectedStatus.label}
                              </Text>
                              <Text style={styles.statusDetail}>
                                {selectedStatus.detail}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })()
                  : null}
              </>
            ) : (
              <Text style={styles.subtle}>
                Select a goal below to view the goal chart.
              </Text>
            )}
          </View>

          <View style={{ gap: 10, marginTop: 14 }}>
            {goals.map((g) => {
              const exerciseName = g.exercises?.name ?? "Exercise";
              const active = g.id === selectedGoalId;

              return (
                <Pressable
                  key={g.id}
                  onPress={() => setSelectedGoalId(g.id)}
                  style={[styles.goalRow, active && styles.goalRowActive]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goalTitle}>{exerciseName}</Text>
                      <Text style={styles.subtle}>{goalSummary(g)}</Text>

                      {!!g.deadline && (
                        <Text style={styles.deadline}>
                          Due{" "}
                          {new Date(g.deadline).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                      )}
                    </View>

                    {active ? (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Selected</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    sectionLabel: {
      color: colors.subtle,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      fontFamily: typography?.fontFamily?.semibold ?? undefined,
    },
    h3: {
      fontSize: 18,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      color: colors.text,
      marginTop: 2,
      letterSpacing: -0.3,
    },
    subtle: {
      color: colors.subtle,
      marginTop: 6,
      fontSize: 13,
      lineHeight: 18,
    },
    deadline: {
      color: colors.subtle,
      marginTop: 6,
      fontSize: 12,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    primaryBtnText: {
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      color: colors.onPrimary ?? "#fff",
      fontSize: 14,
    },
    focusCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      marginBottom: 12,
    },
    focusTitle: {
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      color: colors.text,
      fontSize: 15,
      letterSpacing: -0.2,
    },
    focusMeta: {
      color: colors.subtle,
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: typography?.fontFamily?.medium ?? undefined,
    },
    focusPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    focusPillText: {
      color: colors.onPrimary ?? "#fff",
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    graphShell: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 10,
      minHeight: 320,
      overflow: "hidden",
      gap: 10,
      marginTop: 12,
    },
    goalRow: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    goalRowActive: {
      borderColor: colors.primary,
      backgroundColor: colors.card,
    },
    goalTitle: {
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      color: colors.text,
      fontSize: 14,
      letterSpacing: -0.2,
    },
    activePill: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    activePillText: {
      fontSize: 11,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      color: colors.onPrimary ?? "#fff",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    pointBubble: {
      marginTop: 4,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 4,
    },
    pointBubbleFuture: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    pointBubbleHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    pointBubbleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    pointBubbleLeft: {
      flexShrink: 1,
      flexGrow: 1,
      paddingRight: 8,
    },
    pointBubbleRight: {
      alignItems: "flex-end",
      flexShrink: 0,
    },
    pointBubbleTitle: {
      fontSize: 14,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      color: colors.text,
    },
    pointBubbleDate: {
      fontSize: 11,
      fontFamily: typography?.fontFamily?.medium ?? undefined,
      color: colors.subtle,
      marginTop: 2,
    },
    pointBubbleActual: {
      fontSize: 14,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      color: colors.text,
      textAlign: "right",
    },
    pointBubbleGoal: {
      fontSize: 12,
      fontFamily: typography?.fontFamily?.medium ?? undefined,
      color: colors.subtle,
      textAlign: "right",
      marginTop: 2,
    },
    statusRow: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    statusLabel: {
      color: colors.text,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      fontSize: 13,
    },
    statusDetail: {
      color: colors.subtle,
      fontFamily: typography?.fontFamily?.medium ?? undefined,
      fontSize: 12,
      textAlign: "right",
      flexShrink: 1,
    },
    plannedPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    plannedPillText: {
      fontSize: 10,
      fontFamily: typography?.fontFamily?.bold ?? undefined,
      color: colors.onPrimary ?? "#fff",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    switchRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    switchBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    switchText: {
      fontFamily: typography?.fontFamily?.semibold ?? undefined,
      color: colors.text,
      fontSize: 12,
    },
    switchActive: {
      backgroundColor: colors.primary,
    },
    switchActiveText: {
      color: colors.onPrimary ?? "#fff",
    },
  });
