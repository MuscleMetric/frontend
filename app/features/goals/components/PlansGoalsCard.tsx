// app/(features)/goals/components/PlanGoalsCard.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { usePlanGoals } from "../hooks/usePlanGoals";
import { router } from "expo-router";
import PlanGoalsGraph from "./PlanGoalsGraph";

type Props = { userId?: string | null; colors: any };

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

export default function PlanGoalsCard({ userId, colors }: Props) {
  const { loading, error, plan, planTitle, goals } = usePlanGoals(userId);
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
    [goals, selectedGoalId]
  );

  // selected point info for the big bubble
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

  // reset point info when switching goal or view mode
  const [viewMode, setViewMode] = useState<"twoWeeks" | "overall">("twoWeeks");

  useEffect(() => {
    setSelectedPoint(null);
  }, [viewMode, selectedGoalId]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.h3}>Plan Goals</Text>
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

      <View style={{ height: 8 }} />

      {loading ? (
        <ActivityIndicator />
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
            style={[styles.btn, styles.primary, { marginTop: 12 }]}
            onPress={() => router.push("/features/plans/create/planInfo")}
          >
            <Text style={styles.btnPrimaryText}>Create Plan</Text>
          </Pressable>
        </>
      ) : (
        <>
          {/* Graph */}
          <View style={styles.graphShell}>
            {plan && selectedGoal ? (
              <>
                <PlanGoalsGraph
                  plan={plan}
                  goal={selectedGoal}
                  colors={colors}
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
                {/* Big nicely styled info card */}
                {selectedPoint && viewMode === "twoWeeks" && (
                  <View style={styles.pointBubble}>
                    <Text style={styles.pointBubbleTitle}>
                      {selectedPoint.workoutTitle || "Workout"}
                    </Text>

                    <Text style={styles.pointBubbleDate}>
                      {selectedPoint.date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>

                    {/* Actual on top */}
                    <Text style={styles.pointBubbleActual}>
                      Actual:{" "}
                      {selectedPoint.actualValue != null
                        ? `${selectedPoint.actualValue}${
                            selectedGoal.unit ? ` ${selectedGoal.unit}` : ""
                          }`
                        : "—"}
                    </Text>

                    {/* Goal underneath */}
                    <Text style={styles.pointBubbleGoal}>
                      Goal:{" "}
                      {`${selectedPoint.goalValue}${
                        selectedGoal.unit ? ` ${selectedGoal.unit}` : ""
                      }`}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.subtle}>
                Select a goal below to view the trajectory.
              </Text>
            )}
          </View>

          {/* List becomes the selector */}
          <View style={{ gap: 12, marginTop: 24 }}>
            {goals.map((g) => {
              const start = parseStart(g.notes);
              const exerciseName = g.exercises?.name ?? "Exercise";
              const active = g.id === selectedGoalId;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setSelectedGoalId(g.id)}
                  style={[
                    styles.goalRow,
                    active && {
                      borderColor: colors.primary,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <Text
                    style={[styles.title, active && { color: colors.text }]}
                  >
                    {exerciseName}
                  </Text>
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
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    h3: { fontSize: 16, fontWeight: "800", color: colors.text },
    subtle: { color: colors.subtle },
    title: { fontWeight: "800", color: colors.text },
    deadline: { color: colors.subtle, marginTop: 4 },

    goalRow: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { fontWeight: "800", color: colors.onPrimary ?? "#fff" },

    graphShell: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 8,
      minHeight: 320,
      overflow: "hidden",
      gap: 8,
    },

    pointBubble: {
      marginTop: 6,
      alignSelf: "stretch",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
      gap: 2,
    },
    pointBubbleTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    pointBubbleDate: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.subtle,
      marginBottom: 4,
    },
    pointBubbleActual: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    pointBubbleGoal: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.subtle,
    },

    // range switch
    switchRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    switchBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    switchText: { fontWeight: "700", color: colors.text, fontSize: 12 },
    switchActive: { backgroundColor: colors.primary },
    switchActiveText: { color: colors.onPrimary ?? "#fff" },
  });
