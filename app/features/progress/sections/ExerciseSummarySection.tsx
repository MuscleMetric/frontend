import React from "react";
import { Text } from "react-native";
import { ListRow } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";

export default function ExerciseSummarySection({
  exerciseSummary,
  onOpenExercise,
}: {
  exerciseSummary: ProgressOverview["exercise_summary"];
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <ProgressSection>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
        Exercises
      </Text>

      {exerciseSummary.prompt ? (
        <Text style={{ color: colors.textMuted }}>{exerciseSummary.prompt.subtitle}</Text>
      ) : (
        <Text style={{ color: colors.textMuted }}>
          Your most trained exercises in the last 30 days.
        </Text>
      )}

      {exerciseSummary.top_exercises?.length ? (
        exerciseSummary.top_exercises.map((x) => (
          <ListRow
            key={x.exercise_id}
            title={x.exercise_name}
            subtitle={`${x.sessions_30d} sessions · ${x.trend}`}
            onPress={() => onOpenExercise(x.exercise_id)}
          />
        ))
      ) : (
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>
          No exercise history yet.
        </Text>
      )}
    </ProgressSection>
  );
}
