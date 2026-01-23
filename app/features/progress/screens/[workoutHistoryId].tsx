import React from "react";
import { useLocalSearchParams } from "expo-router";
import WorkoutHistoryDetailScreen from "@/app/features/history/screens/WorkoutHistoryDetailScreen";

export default function HistoryDetailRoute() {
  const { workoutHistoryId } = useLocalSearchParams<{ workoutHistoryId?: string }>();
  return <WorkoutHistoryDetailScreen workoutHistoryId={workoutHistoryId ?? ""} />;
}
