// app/features/workouts/sections/OptionalSessionsSection.tsx

import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ListRow, Button, WorkoutCover } from "@/ui";

type OptionalSessions = {
  title: string;
  actionCreate: boolean;
  items: Array<{
    workoutId: string;
    title: string;
    imageKey: string | null;
    previewText: string;
    lastDoneAt: string | null;
  }>;
};

function lastDoneLabel(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;

  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Last done today";
  if (days === 1) return "Last done yesterday";
  return `Last done ${days}d ago`;
}

export function OptionalSessionsSection({
  optional,
  onOpenCreate,
  onPressWorkout,
}: {
  optional: OptionalSessions;
  onOpenCreate: () => void;
  onPressWorkout?: (workoutId: string) => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const items = optional.items ?? [];

  if (items.length === 0) return null;

  React.useEffect(() => {
    console.group("🟦 Optional Sessions — Rendered Workouts");
    optional.items.forEach((w, idx) => {
      console.log({
        index: idx,
        workoutId: w.workoutId,
        title: w.title,
        imageKey: w.imageKey,
        previewText: w.previewText,
        lastDoneAt: w.lastDoneAt,
        source: "optionalSessions payload (user-owned by SQL)",
      });
    });
    console.groupEnd();
  }, [optional.items]);

  return (
    <View style={{ gap: layout.space.sm }}>
      {/* Header (same pattern as Plan Schedule) */}
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
          {optional.title}
        </Text>

        {optional.actionCreate ? (
          <Button
            title="Create"
            variant="ghost"
            fullWidth={false}
            onPress={onOpenCreate}
          />
        ) : null}
      </View>

      {/* Rows */}
      <View style={{ gap: layout.space.sm }}>
        {items.map((w) => {
          const lastDone = lastDoneLabel(w.lastDoneAt);

          return (
            <ListRow
              key={w.workoutId}
              title={w.title}
              subtitle={
                lastDone ? `${w.previewText} · ${lastDone}` : w.previewText
              }
              left={
                <WorkoutCover
                  imageKey={w.imageKey}
                  variant="tile"
                  tileSize={68}
                  radius={14}
                  zoom={1.05}
                />
              }
              showChevron={true}
              onPress={
                onPressWorkout ? () => onPressWorkout(w.workoutId) : undefined
              }
            />
          );
        })}
      </View>
    </View>
  );
}
