// app/features/plans/edit/workout.tsx
import React, { useMemo } from "react";
import { View, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/lib/useAppTheme";
import { useEditPlan } from "./store";

import { ScreenHeader, Icon, Button, Card, ListRow, WorkoutCover } from "@/ui";

export default function EditPlanWorkoutsHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, layout, typography } = useAppTheme() as any;

  const { workouts, addWorkout, removeWorkout } = useEditPlan();

  const totalExercises = useMemo(
    () => workouts.reduce((sum, w) => sum + (w.exercises?.length ?? 0), 0),
    [workouts]
  );

  const footerH = 84 + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Workouts"
        right={
          <View style={{ width: 44, alignItems: "flex-end" }}>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: typography.fontFamily.semibold,
                fontSize: 12,
              }}
            >
              {workouts.length}
            </Text>
          </View>
        }
      />

      <View style={{ flex: 1, paddingBottom: footerH }}>
        <View
          style={{
            paddingHorizontal: layout.space.lg,
            paddingTop: layout.space.lg,
            gap: layout.space.lg,
          }}
        >
          {/* Header block */}
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: colors.text,
                fontFamily: typography.fontFamily.bold,
                fontSize: 22,
                letterSpacing: -0.3,
              }}
            >
              Weekly routine
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: typography.fontFamily.medium,
                fontSize: 13,
              }}
            >
              {workouts.length} workouts • {totalExercises} exercises
            </Text>
          </View>

          {/* List */}
          <View style={{ gap: layout.space.sm }}>
            {workouts.map((w, index) => {
              const hasExercises = (w.exercises?.length ?? 0) > 0;

              return (
                <ListRow
                  key={`${index}-${w.id ?? "draft"}`}
                  title={`${index + 1}. ${w.title || "Workout"}`}
                  subtitle={
                    hasExercises
                      ? `${w.exercises.length} exercises`
                      : "Needs exercises"
                  }
                  tone={hasExercises ? "default" : "default"}
                  left={
                    <WorkoutCover
                      imageKey={w.imageKey ?? undefined}
                      variant="tile"
                      tileSize={68}
                      radius={14}
                      zoom={1.05}
                    />
                  }
                  rightNode={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      {!hasExercises ? (
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: colors.warningBg ?? colors.surface,
                            borderWidth: 1,
                            borderColor: colors.warning ?? colors.border,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.warningText ?? colors.text,
                              fontFamily: typography.fontFamily.bold,
                              fontSize: 11,
                            }}
                          >
                            Incomplete
                          </Text>
                        </View>
                      ) : null}

                      <IconButton
                        icon="trash-outline"
                        color={colors.danger}
                        onPress={() => {
                          Alert.alert(
                            "Delete workout?",
                            `Remove “${w.title || "Workout"}” from this plan?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => removeWorkout(index),
                              },
                            ]
                          );
                        }}
                      />
                    </View>
                  }
                  onPress={() => {
                    // ✅ Navigate to your workout editor screen for this index
                    // If your editor route is /features/plans/edit/workoutEditor
                    router.push({
                      pathname: "/features/plans/edit/workout",
                      params: { index: String(index) },
                    });
                  }}
                />
              );
            })}
          </View>

          {/* Empty state */}
          {workouts.length === 0 ? (
            <Card>
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: typography.fontFamily.bold,
                  }}
                >
                  No workouts yet
                </Text>
                <Text style={{ color: colors.textMuted }}>
                  Add your first workout to start building this plan.
                </Text>
              </View>
            </Card>
          ) : null}
        </View>
      </View>

      {/* Sticky footer */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: layout.space.lg,
          paddingTop: 12,
          paddingBottom: insets.bottom + layout.space.md,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          title="+ Add workout"
          onPress={() => {
            const newIndex = addWorkout();
            router.push({
              pathname: "/features/plans/edit/workout",
              params: { index: String(newIndex) },
            });
          }}
        />
      </View>
    </View>
  );
}

function IconButton({
  icon,
  color,
  onPress,
}: {
  icon: any; // Ionicons name
  color: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderRelease={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Icon name={icon} size={18} color={color} />
    </View>
  );
}
