// app/features/workouts/live/review/ui/ExerciseReviewCard.tsx
import React, { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { ReviewExerciseVM } from "../reviewTypes";

function Cell(props: { text: string; muted?: boolean; align?: "left" | "center" | "right" }) {
  const { colors, typography } = useAppTheme();
  return (
    <Text
      style={{
        flex: 1,
        textAlign: props.align ?? "center",
        color: props.muted ? colors.textMuted : colors.text,
        fontFamily: props.muted ? typography.fontFamily.medium : typography.fontFamily.semibold,
        fontSize: props.muted ? 11 : 13,
      }}
      numberOfLines={1}
    >
      {props.text}
    </Text>
  );
}

export function ExerciseReviewCard(props: {
  index: number;
  exercise: ReviewExerciseVM;
}) {
  const { colors, typography } = useAppTheme();
  const [open, setOpen] = useState(props.index === 0);

  const subtitle = useMemo(() => {
    const tags: string[] = [];
    if (props.exercise.supersetLabel) tags.push(props.exercise.supersetLabel);
    if (props.exercise.isDropset) tags.push("Dropset");
    if (props.exercise.equipment) tags.push(props.exercise.equipment);
    return tags.length ? tags.join(" • ") : "";
  }, [props.exercise]);

  const hasIssue = props.exercise.hasNoCompletedSets || props.exercise.missingWeightSetCount > 0;

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
        style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 15 }}>
            {props.exercise.name}
          </Text>

          {subtitle ? (
            <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: 12, marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : null}

          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: 12, marginTop: 8 }}>
            {props.exercise.completedSetsCount} set{props.exercise.completedSetsCount === 1 ? "" : "s"} completed
            {props.exercise.volumeKg > 0 ? ` • ${Math.round(props.exercise.volumeKg)} kg vol` : ""}
          </Text>

          {props.exercise.hasNoCompletedSets ? (
            <Text style={{ color: "#B45309", fontFamily: typography.fontFamily.semibold, fontSize: 12, marginTop: 8 }}>
              No completed sets recorded
            </Text>
          ) : props.exercise.missingWeightSetCount > 0 ? (
            <Text style={{ color: "#B45309", fontFamily: typography.fontFamily.semibold, fontSize: 12, marginTop: 8 }}>
              {props.exercise.missingWeightSetCount} set{props.exercise.missingWeightSetCount === 1 ? "" : "s"} missing weight
            </Text>
          ) : null}
        </View>

        <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.bold, fontSize: 16 }}>
          {open ? "▴" : "▾"}
        </Text>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          {/* table header */}
          <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
            <Cell text="SET" muted align="left" />
            {props.exercise.sets[0]?.isCardio ? (
              <>
                <Cell text="TIME" muted />
                <Cell text="DIST" muted />
              </>
            ) : (
              <>
                <Cell text="KG" muted />
                <Cell text="REPS" muted />
              </>
            )}
            <Cell text="" muted align="right" />
          </View>

          {/* rows */}
          <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
            {props.exercise.sets.map((s) => {
              const rowBg = s.isComplete ? "transparent" : "#FFF7ED";
              const missing = !s.isComplete;

              return (
                <View
                  key={`${s.setNumber}-${s.dropIndex}`}
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
                  <Cell text={String(s.setNumber)} align="left" />
                  {s.isCardio ? (
                    <>
                      <Cell text={s.timeSeconds != null ? String(s.timeSeconds) : "—"} muted={s.timeSeconds == null} />
                      <Cell text={s.distance != null ? String(s.distance) : "—"} muted={s.distance == null} />
                    </>
                  ) : (
                    <>
                      <Cell text={s.weight != null ? String(s.weight) : "—"} muted={s.weight == null} />
                      <Cell text={s.reps != null ? String(s.reps) : "—"} muted={s.reps == null} />
                    </>
                  )}

                  <Text
                    style={{
                      flex: 1,
                      textAlign: "right",
                      color: s.isComplete ? "#16A34A" : "#B45309",
                      fontFamily: typography.fontFamily.bold,
                      fontSize: 12,
                    }}
                    numberOfLines={1}
                  >
                    {s.isComplete ? "✓" : s.missingLabel ?? "Missing"}
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
