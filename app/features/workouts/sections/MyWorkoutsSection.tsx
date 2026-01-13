// app/features/workouts/sections/MyWorkoutsSection.tsx

import React from "react";
import { View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ListRow, Button, EmptyState, WorkoutCover } from "@/ui";

type MyWorkoutsData = {
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
    imageKey: string | null;
    exerciseCount: number;
    previewText: string;
    lastDoneAt: string | null;
  }>;
};

function lastDoneLabel(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function MyWorkoutsSection({
  mode,
  myWorkouts,
  onOpenCreate,
  onExplorePlans,
  onPressWorkout,
  onSeeAll,
}: {
  mode: "new_user" | "no_plan";
  myWorkouts: MyWorkoutsData;
  onOpenCreate: () => void;
  onExplorePlans?: () => void;
  onPressWorkout?: (workoutId: string) => void;
  onSeeAll?: () => void;
}) {
  const { layout } = useAppTheme();

  const hasItems = myWorkouts.items && myWorkouts.items.length > 0;
  const showCreateOnHeader = mode === "no_plan";

  return (
    <View style={{ gap: layout.space.sm }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <ListRow title={myWorkouts.title} showChevron={false} />
        </View>

        {myWorkouts.seeAll && onSeeAll ? (
          <View style={{ marginLeft: layout.space.sm }}>
            <Button title="See all" variant="text" fullWidth={false} onPress={onSeeAll} />
          </View>
        ) : null}

        {showCreateOnHeader ? (
          <View style={{ marginLeft: layout.space.sm }}>
            <Button
              title="Create"
              variant="secondary"
              fullWidth={false}
              onPress={onOpenCreate}
            />
          </View>
        ) : null}
      </View>

      {/* Empty */}
      {!hasItems && myWorkouts.emptyState ? (
        <View style={{ gap: layout.space.sm }}>
          <EmptyState
            title={myWorkouts.emptyState.title}
            message={myWorkouts.emptyState.subtitle}
            ctaLabel={myWorkouts.emptyState.ctaPrimary.label}
            onCta={onOpenCreate}
          />

          {myWorkouts.emptyState.ctaSecondary?.label && onExplorePlans ? (
            <Button
              title={myWorkouts.emptyState.ctaSecondary.label}
              variant="secondary"
              onPress={onExplorePlans}
            />
          ) : null}
        </View>
      ) : null}

      {/* List */}
      {hasItems ? (
        <View style={{ gap: layout.space.sm }}>
          {myWorkouts.items.map((w) => (
            <ListRow
              key={w.workoutId}
              title={w.title}
              subtitle={w.previewText}
              rightText={lastDoneLabel(w.lastDoneAt)}
              left={
                <WorkoutCover imageKey={w.imageKey} height={56} radius={14} />
              }
              onPress={onPressWorkout ? () => onPressWorkout(w.workoutId) : undefined}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
