// app/features/workouts/sections/SuggestedSection.tsx

import React from "react";
import { View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ListRow, WorkoutCover, Button } from "@/ui";

export function SuggestedSection({
  suggested,
  onSeeAll,
  onPressWorkout,
}: {
  suggested: {
    title: string;
    seeAll: boolean;
    items: Array<{
      workoutId: string;
      title: string;
      imageKey: string | null;
      previewText: string;
      tapAction: "preview";
    }>;
  } | null;
  onSeeAll?: () => void;
  onPressWorkout?: (workoutId: string) => void;
}) {
  const { layout } = useAppTheme();

  if (!suggested) return null;
  if (!suggested.items || suggested.items.length === 0) return null;

  return (
    <View style={{ gap: layout.space.sm }}>
      {/* Header row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <ListRow title={suggested.title} showChevron={false} />
        </View>

        {suggested.seeAll && onSeeAll ? (
          <View style={{ marginLeft: layout.space.sm }}>
            <Button title="See all" variant="text" fullWidth={false} onPress={onSeeAll} />
          </View>
        ) : null}
      </View>

      {/* Items */}
      <View style={{ gap: layout.space.sm }}>
        {suggested.items.map((it) => (
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
            onPress={
              onPressWorkout
                ? () => onPressWorkout(it.workoutId)
                : undefined
            }
          />
        ))}
      </View>
    </View>
  );
}
