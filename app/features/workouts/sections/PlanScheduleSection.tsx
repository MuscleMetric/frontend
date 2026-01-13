// app/features/workouts/sections/PlanScheduleSection.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ListRow, Button, WorkoutCover, Icon } from "@/ui";

type PlanSchedule = {
  title: string;
  actions: { viewAll: boolean; edit: boolean };
  items: Array<{
    planWorkoutId: string;
    workoutId: string;
    title: string;
    orderIndex: number | null;
    weeklyComplete: boolean;
    imageKey: string | null;
    previewText: string;
    lastDoneAt: string | null;
  }>;
};

export function PlanScheduleSection({
  schedule,
  onPressWorkout,
  onViewAll,
  onEdit,
}: {
  schedule: PlanSchedule;
  onPressWorkout?: (args: { workoutId: string; planWorkoutId: string }) => void;
  onViewAll?: () => void;
  onEdit?: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const items = schedule.items ?? [];
  if (items.length === 0) return null;

  const firstIncompleteIndex = items.findIndex((x) => !x.weeklyComplete);

  return (
    <View style={{ gap: layout.space.sm }}>
      {/* Header (NOT a card) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: typography.fontFamily.bold,
            fontSize: typography.size.h2,
            lineHeight: typography.lineHeight.h2,
            color: colors.text,
          }}
          numberOfLines={1}
        >
          {schedule.title}
        </Text>

        <View style={{ flexDirection: "row", gap: layout.space.sm }}>
          {schedule.actions.viewAll && onViewAll ? (
            <Button
              title="View all"
              variant="ghost"
              fullWidth={false}
              onPress={onViewAll}
            />
          ) : null}

          {schedule.actions.edit && onEdit ? (
            <Button
              title="Edit"
              variant="ghost"
              fullWidth={false}
              onPress={onEdit}
            />
          ) : null}
        </View>
      </View>

      {/* Rows */}
      <View style={{ gap: layout.space.sm }}>
        {items.map((pw, idx) => {
          const isNext = idx === firstIncompleteIndex && !pw.weeklyComplete;

          const rightNode = pw.weeklyComplete ? (
            <Icon name="checkmark" size={18} color={colors.success} />
          ) : isNext ? (
            <Text
              style={{
                fontFamily: typography.fontFamily.semibold,
                fontSize: typography.size.sub,
                color: colors.textMuted,
              }}
            >
              Next
            </Text>
          ) : null;

          return (
            <ListRow
              key={pw.planWorkoutId}
              title={pw.title}
              subtitle={pw.previewText}
              left={
                <WorkoutCover
                  imageKey={pw.imageKey}
                  variant="tile"          // ✅ IMPORTANT
                  tileSize={68}
                  radius={14}
                  zoom={1}                // or 1.08 if your tiles still feel wide
                />
              }
              rightNode={rightNode ?? undefined}
              disabled={pw.weeklyComplete}   // ✅ completed rows not clickable
              showChevron={!pw.weeklyComplete}
              onPress={
                !pw.weeklyComplete && onPressWorkout
                  ? () =>
                      onPressWorkout({
                        workoutId: pw.workoutId,
                        planWorkoutId: pw.planWorkoutId,
                      })
                  : undefined
              }
            />
          );
        })}
      </View>
    </View>
  );
}
