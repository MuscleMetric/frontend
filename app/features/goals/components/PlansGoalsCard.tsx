// app/(features)/goals/components/PlanGoalsCard.tsx
import React, { useMemo, useState, useEffect } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { usePlanGoals } from "../hooks/usePlanGoals";
import PlanGoalsGraph from "./PlanGoalsGraph";
import { useAppTheme } from "../../../../lib/useAppTheme";

type Props = { userId?: string | null };

function fmtMode(m: "exercise_weight" | "exercise_reps" | "distance" | "time") {
  switch (m) {
    case "exercise_weight":
      return "Weight";
    case "exercise_reps":
      return "Reps";
    case "distance":
      return "Distance";
    case "time":
      return "Time";
    default:
      return m;
  }
}
function parseStart(notes?: string | null): number | null {
  if (!notes) return null;
  try {
    const o = JSON.parse(notes);
    if (typeof o?.start === "number") return o.start;
  } catch {}
  return null;
}

export default function PlanGoalsCard({ userId }: Props) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const { loading, error, plan, planTitle, goals } = usePlanGoals(userId);

  const endText = useMemo(() => {
    if (!plan?.end_date) return null;
    const d = new Date(plan.end_date);
    return isNaN(d.getTime())
      ? plan.end_date
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [plan?.end_date]);

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const selectedGoal = useMemo(
    () => goals.find((g) => g.id === (selectedGoalId ?? goals[0]?.id)),
    [goals, selectedGoalId]
  );

  const [selectedPoint, setSelectedPoint] = useState<{
    date: Date;
    goalValue: number;
    actualValue?: number | null;
    workoutTitle: string | null;
    kind: "goal" | "actual";
  } | null>(null);

  useEffect(() => {
    if (goals.length && !selectedGoalId) setSelectedGoalId(goals[0].id);
  }, [goals, selectedGoalId]);

  const [viewMode, setViewMode] = useState<"twoWeeks" | "overall">("twoWeeks");
  useEffect(() => setSelectedPoint(null), [viewMode, selectedGoalId]);

  const now = new Date();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Plan</Text>
          <Text style={styles.h3}>Goals</Text>
        </View>

        {/* range switch */}
        <View style={styles.switchRow}>
          <Pressable
            onPress={() => setViewMode("twoWeeks")}
            style={[styles.switchBtn, viewMode === "twoWeeks" && styles.switchActive]}
          >
            <Text style={[styles.switchText, viewMode === "twoWeeks" && styles.switchActiveText]}>
              2 Weeks
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode("overall")}
            style={[styles.switchBtn, viewMode === "overall" && styles.switchActive]}
          >
            <Text style={[styles.switchText, viewMode === "overall" && styles.switchActiveText]}>
              Overall
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.subtle}>
        {plan ? `From “${planTitle}”${endText ? ` • Ends ${endText}` : ""}` : "No active plan"}
      </Text>

      <View style={{ height: 12 }} />

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={[styles.subtle, { color: colors.danger ?? "#e11" }]}>{error}</Text>
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
          <View style={styles.graphShell}>
            {plan && selectedGoal ? (
              <>
                <PlanGoalsGraph
                  plan={plan}
                  goal={selectedGoal}
                  viewMode={viewMode}
                  userId={userId}
                  onPointPress={({ date, goalValue, actualValue, workoutTitle, kind }) => {
                    setSelectedPoint({
                      date,
                      goalValue,
                      actualValue: actualValue ?? null,
                      workoutTitle,
                      kind,
                    });
                  }}
                />

                {selectedPoint && viewMode === "twoWeeks" && (
                  (() => {
                    const isFuture = selectedPoint.date.getTime() > now.getTime() + 60 * 1000;

                    if (isFuture) {
                      return (
                        <View style={[styles.pointBubble, styles.pointBubbleFuture]}>
                          <View style={styles.pointBubbleHeaderRow}>
                            <Text style={styles.pointBubbleTitle}>
                              {selectedPoint.workoutTitle || "Workout"}
                            </Text>
                            <View style={styles.plannedPill}>
                              <Text style={styles.plannedPillText}>Planned</Text>
                            </View>
                          </View>

                          <Text style={styles.pointBubbleDate}>
                            {selectedPoint.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </Text>

                          <Text style={styles.pointBubbleGoal}>
                            Goal for this session:{" "}
                            {`${selectedPoint.goalValue}${selectedGoal.unit ? ` ${selectedGoal.unit}` : ""}`}
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
                              {selectedPoint.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </Text>
                          </View>

                          <View style={styles.pointBubbleRight}>
                            <Text style={styles.pointBubbleActual}>
                              {selectedPoint.actualValue != null
                                ? `${selectedPoint.actualValue}${selectedGoal.unit ? ` ${selectedGoal.unit}` : ""}`
                                : "—"}
                            </Text>
                            <Text style={styles.pointBubbleGoal}>
                              Goal:{" "}
                              {`${selectedPoint.goalValue}${selectedGoal.unit ? ` ${selectedGoal.unit}` : ""}`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()
                )}
              </>
            ) : (
              <Text style={styles.subtle}>Select a goal below to view the trajectory.</Text>
            )}
          </View>

          <View style={{ gap: 10, marginTop: 14 }}>
            {goals.map((g) => {
              const start = parseStart(g.notes);
              const exerciseName = g.exercises?.name ?? "Exercise";
              const active = g.id === selectedGoalId;

              return (
                <Pressable
                  key={g.id}
                  onPress={() => setSelectedGoalId(g.id)}
                  style={[styles.goalRow, active && styles.goalRowActive]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goalTitle}>{exerciseName}</Text>
                      <Text style={styles.subtle}>
                        {fmtMode(g.type)} → {g.target_number}
                        {g.unit ? ` ${g.unit}` : ""}
                        {start != null ? `  (start ${start}${g.unit ?? ""})` : ""}
                      </Text>
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

                    {active && (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Selected</Text>
                      </View>
                    )}
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
    subtle: { color: colors.subtle, marginTop: 6, fontSize: 13, lineHeight: 18 },
    deadline: { color: colors.subtle, marginTop: 6, fontSize: 12 },

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
    pointBubbleLeft: { flexShrink: 1, flexGrow: 1, paddingRight: 8 },
    pointBubbleRight: { alignItems: "flex-end", flexShrink: 0 },
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
    switchBtn: { paddingVertical: 8, paddingHorizontal: 12 },
    switchText: {
      fontFamily: typography?.fontFamily?.semibold ?? undefined,
      color: colors.text,
      fontSize: 12,
    },
    switchActive: { backgroundColor: colors.primary },
    switchActiveText: { color: colors.onPrimary ?? "#fff" },
  });
