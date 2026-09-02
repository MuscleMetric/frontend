// app/features/workouts/sections/OptionalSessionsSection.tsx

import React from "react";
import { Alert, View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ListRow, Button, WorkoutCover } from "@/ui";

import { log } from "@/lib/logger";

type OptionalSessions = {
  title: string;
  actionCreate: boolean;
  items: {
    workoutId: string;
    title: string;
    imageKey: string | null;
    previewText: string;
    lastDoneAt: string | null;
  }[];
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
  onQuickStart,
  onPressWorkout,
}: {
  optional: OptionalSessions;
  onOpenCreate: () => void;
  onQuickStart?: () => void;
  onPressWorkout?: (workoutId: string) => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const items = optional.items ?? [];
  const maxTemplates = 15;
  const templateCount = items.length;
  const isAtTemplateLimit = templateCount >= maxTemplates;

  React.useEffect(() => {
    console.group("🟦 Optional Sessions — Rendered Workouts");
    log("templateCount:", templateCount);
    log("maxTemplates:", maxTemplates);
    log("isAtTemplateLimit:", isAtTemplateLimit);

    optional.items.forEach((w, idx) => {
      log({
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
  }, [optional.items, templateCount, maxTemplates, isAtTemplateLimit]);

  if (items.length === 0 && !onQuickStart) return null;

  const handleCreatePress = () => {
    if (isAtTemplateLimit) {
      Alert.alert(
        "Workout limit reached",
        "You can save up to 15 workouts. Delete one before creating another.",
      );
      return;
    }

    onOpenCreate();
  };

  return (
    <View style={{ gap: layout.space.sm }}>
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
            onPress={handleCreatePress}
          />
        ) : null}
      </View>

      <View style={{ gap: layout.space.sm }}>
        {onQuickStart ? (
          <ListRow
            title="Quick Start Workout"
            subtitle="Start empty and add exercises as you go"
            left={
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: typography.fontFamily.bold,
                    fontSize: typography.size.h2,
                    color: colors.text,
                  }}
                >
                  +
                </Text>
              </View>
            }
            showChevron={true}
            onPress={onQuickStart}
          />
        ) : null}

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
