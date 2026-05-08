// app/features/workouts/review/ui/ExerciseReviewCard.tsx
import React, { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { ReviewExerciseVM, ReviewSetRow } from "../reviewTypes";
import { getExerciseLoggingProfile } from "../../logging/exerciseLoggingProfile";

function fmtNum(n: number, maxDp = 2) {
  const rounded = Number(n.toFixed(maxDp));
  return rounded.toString();
}

function formatTime(seconds: number | null) {
  if (seconds == null) return "—";

  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  if (mins <= 0 && secs > 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;

  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

function Cell(props: {
  text: string;
  muted?: boolean;
  align?: "left" | "center" | "right";
  flex?: number;
}) {
  const { colors, typography } = useAppTheme();

  return (
    <Text
      style={{
        flex: props.flex ?? 1,
        textAlign: props.align ?? "center",
        color: props.muted ? colors.textMuted : colors.text,
        fontFamily: props.muted
          ? typography.fontFamily.medium
          : typography.fontFamily.semibold,
        fontSize: props.muted ? 11 : 13,
      }}
      numberOfLines={1}
    >
      {props.text}
    </Text>
  );
}

function getColumns(exercise: ReviewExerciseVM) {
  const profile = getExerciseLoggingProfile(exercise);

  if (profile.loggingType === "cardio") {
    return [
      { key: "time", label: "TIME" },
      { key: "distance", label: "DIST" },
    ] as const;
  }

  if (
    profile.loggingType === "timed" ||
    profile.loggingType === "timed_weighted"
  ) {
    return [
      { key: "time", label: "TIME" },
      { key: "weight", label: "KG" },
    ] as const;
  }

  if (profile.loggingType === "bodyweight") {
    return [{ key: "reps", label: "REPS" }] as const;
  }

  if (profile.loggingType === "assisted") {
    return [
      { key: "reps", label: "REPS" },
      { key: "weight", label: "ASSIST" },
    ] as const;
  }

  return [
    { key: "weight", label: "KG" },
    { key: "reps", label: "REPS" },
  ] as const;
}

function valueForColumn(columnKey: string, set: ReviewSetRow) {
  switch (columnKey) {
    case "time":
      return {
        text: formatTime(set.timeSeconds),
        muted: set.timeSeconds == null,
      };

    case "distance":
      return {
        text: set.distance != null ? `${fmtNum(set.distance)}km` : "—",
        muted: set.distance == null,
      };

    case "weight":
      return {
        text: set.weight != null ? fmtNum(set.weight) : "—",
        muted: set.weight == null,
      };

    case "reps":
      return {
        text: set.reps != null ? String(set.reps) : "—",
        muted: set.reps == null,
      };

    default:
      return { text: "—", muted: true };
  }
}

export function ExerciseReviewCard(props: {
  index: number;
  exercise: ReviewExerciseVM;
}) {
  const { colors, typography } = useAppTheme();
  const [open, setOpen] = useState(props.index === 0);

  const columns = useMemo(
    () => getColumns(props.exercise),
    [props.exercise],
  );

  const subtitle = useMemo(() => {
    const tags: string[] = [];

    if (props.exercise.supersetLabel) tags.push(props.exercise.supersetLabel);
    if (props.exercise.isDropset) tags.push("Dropset");
    if (props.exercise.equipment) tags.push(props.exercise.equipment);

    return tags.length ? tags.join(" • ") : "";
  }, [props.exercise]);

  const hasIssue =
    props.exercise.hasNoCompletedSets ||
    props.exercise.missingWeightSetCount > 0;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: hasIssue ? "#F2D48C" : colors.border,
        backgroundColor: colors.surface ?? colors.bg,
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 15,
            }}
          >
            {props.exercise.name}
          </Text>

          {subtitle ? (
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: typography.fontFamily.medium,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {subtitle}
            </Text>
          ) : null}

          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fontFamily.medium,
              fontSize: 12,
              marginTop: 8,
            }}
          >
            {props.exercise.completedSetsCount} set
            {props.exercise.completedSetsCount === 1 ? "" : "s"} completed
            {props.exercise.volumeKg > 0
              ? ` • ${Math.round(props.exercise.volumeKg)} kg vol`
              : ""}
          </Text>

          {props.exercise.hasNoCompletedSets ? (
            <Text
              style={{
                color: "#B45309",
                fontFamily: typography.fontFamily.semibold,
                fontSize: 12,
                marginTop: 8,
              }}
            >
              No completed sets recorded
            </Text>
          ) : props.exercise.missingWeightSetCount > 0 ? (
            <Text
              style={{
                color: "#B45309",
                fontFamily: typography.fontFamily.semibold,
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {props.exercise.missingWeightSetCount} set
              {props.exercise.missingWeightSetCount === 1 ? "" : "s"} missing
              weight
            </Text>
          ) : null}
        </View>

        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.bold,
            fontSize: 16,
          }}
        >
          {open ? "▴" : "▾"}
        </Text>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 14,
              paddingVertical: 10,
              gap: 8,
            }}
          >
            <Cell text="SET" muted align="left" />
            {columns.map((column) => (
              <Cell key={column.key} text={column.label} muted />
            ))}
            <Cell text="" muted align="right" />
          </View>

          <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
            {props.exercise.sets.map((set) => {
              const rowBg = set.isComplete ? "transparent" : "#FFF7ED";
              const missing = !set.isComplete;

              return (
                <View
                  key={`${set.setNumber}-${set.dropIndex}`}
                  style={{
                    borderWidth: 1,
                    borderColor: missing ? "#FED7AA" : colors.border,
                    backgroundColor: rowBg,
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Cell text={String(set.setNumber)} align="left" />

                  {columns.map((column) => {
                    const value = valueForColumn(column.key, set);

                    return (
                      <Cell
                        key={column.key}
                        text={value.text}
                        muted={value.muted}
                      />
                    );
                  })}

                  <Text
                    style={{
                      flex: 1,
                      textAlign: "right",
                      color: set.isComplete ? "#16A34A" : "#B45309",
                      fontFamily: typography.fontFamily.bold,
                      fontSize: 12,
                    }}
                    numberOfLines={1}
                  >
                    {set.isComplete ? "✓" : set.missingLabel ?? "Missing"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}