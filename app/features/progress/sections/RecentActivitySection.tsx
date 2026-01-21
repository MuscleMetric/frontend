import React from "react";
import { Text, View } from "react-native";
import { Button, ListRow } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";

export default function RecentActivitySection({
  recent,
  onOpenHistory,
  onOpenWorkoutHistoryDetail,
}: {
  recent: ProgressOverview["recent_activity"];
  onOpenHistory: () => void;
  onOpenWorkoutHistoryDetail: (workoutHistoryId: string) => void;
}) {
  const { colors } = useAppTheme();

  const lw = recent.last_workout;

  return (
    <ProgressSection>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          Recent activity
        </Text>
        <Button title="History" variant="secondary" onPress={onOpenHistory} />
      </View>

      {!lw ? (
        <Text style={{ color: colors.textMuted }}>No workouts yet.</Text>
      ) : (
        <>
          <ListRow
            title={lw.title}
            subtitle={new Date(lw.completed_at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
            right={lw.duration_seconds ? `${Math.round(lw.duration_seconds / 60)}m` : undefined}
            onPress={() => onOpenWorkoutHistoryDetail(lw.workout_history_id)}
          />

          {lw.top_items?.length ? (
            <View style={{ marginTop: 6 }}>
              {lw.top_items.map((it) => (
                <ListRow
                  key={it.exercise_id}
                  title={it.exercise_name}
                  subtitle={it.summary}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </ProgressSection>
  );
}
