import React from "react";
import { Text, View } from "react-native";
import { ListRow } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";
import { formatPct } from "../data/progress.mapper";

export default function StrengthHighlightsSection({
  highlights,
  onOpenExercise,
}: {
  highlights: ProgressOverview["highlights"];
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <ProgressSection>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
        Strength highlights
      </Text>

      {highlights.primary ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {highlights.primary.title}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            {highlights.primary.subtitle}
          </Text>
        </View>
      ) : (
        <Text style={{ color: colors.textMuted }}>
          Log more workouts to unlock PR highlights.
        </Text>
      )}

      {highlights.cards?.length ? (
        <View style={{ marginTop: 6 }}>
          {highlights.cards.map((c) => (
            <ListRow
              key={c.exercise_id}
              title={c.exercise_name}
              subtitle={
                c.delta_pct == null ? "New PR" : `${formatPct(c.delta_pct)}`
              }
              right={`${c.current_value.toFixed(1)} e1RM`}
              onPress={() => onOpenExercise(c.exercise_id)}
            />
          ))}
        </View>
      ) : null}
    </ProgressSection>
  );
}
