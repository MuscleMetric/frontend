// app/features/history/screens/WorkoutHistoryEmptyScreen.tsx
import React from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { Screen, ScreenHeader } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { HistoryEmptyState } from "../ui/HistoryEmptyState";

export default function WorkoutHistoryEmptyScreen() {
  const { layout } = useAppTheme();

  return (
    <Screen>
      <ScreenHeader title="History" />

      <ScrollView contentContainerStyle={{ padding: layout.space.lg, gap: 12 }}>
        <HistoryEmptyState
          onStartWorkout={() => {
            router.push("/(tabs)/workouts");
          }}
        />
      </ScrollView>
    </Screen>
  );
}
