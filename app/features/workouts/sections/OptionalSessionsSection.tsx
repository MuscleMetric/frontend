// app/features/workouts/sections/OptionalSessionsSection.tsx

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ListRow, Button, Card, WorkoutCover } from "@/ui";

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
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Last done: Today";
  if (days === 1) return "Last done: Yesterday";
  return `Last done: ${days}d ago`;
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

  return (
    <View style={{ gap: layout.space.sm }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <ListRow title={optional.title} showChevron={false} />
        </View>

        {optional.actionCreate ? (
          <View style={{ marginLeft: layout.space.sm }}>
            <Button
              title="Create"
              variant="text"
              fullWidth={false}
              onPress={onOpenCreate}
            />
          </View>
        ) : null}
      </View>

      {/* Grid */}
      <View style={[styles.grid, { gap: layout.space.sm }]}>
        {items.map((w) => {
          const ld = lastDoneLabel(w.lastDoneAt);

          return (
            <View key={w.workoutId} style={styles.cell}>
              <Card>
                <Pressable
                  onPress={
                    onPressWorkout ? () => onPressWorkout(w.workoutId) : undefined
                  }
                  style={{ gap: layout.space.sm }}
                >
                  <WorkoutCover
                    imageKey={w.imageKey}
                    height={120}
                    radius={layout.radius.lg}
                    title={w.title}
                    subtitle={w.previewText}
                  />

                  {ld ? (
                    <Text
                      style={{
                        fontFamily: typography.fontFamily.medium,
                        fontSize: typography.size.meta,
                        color: colors.textMuted,
                      }}
                      numberOfLines={1}
                    >
                      {ld}
                    </Text>
                  ) : null}
                </Pressable>
              </Card>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "50%",
    paddingRight: 6, // minor spacing; visual gap already handled above
  },
});
