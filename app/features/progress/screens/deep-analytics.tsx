import React from "react";
import { useLocalSearchParams } from "expo-router";
import DeepAnalytics from "../sections/DeepAnalytics";

export default function DeepAnalyticsRoute() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
  return <DeepAnalytics exerciseId={exerciseId ?? ""} />;
}
