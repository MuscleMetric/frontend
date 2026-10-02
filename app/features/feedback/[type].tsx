import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import FeedbackScreen from "@/features/feedback/FeedbackScreen";

export default function FeedbackRoute() {
  const { type } = useLocalSearchParams<{ type?: string | string[] }>();
  if (type !== "issue" && type !== "improvement" && type !== "rating") {
    return <Redirect href="/features/settings" />;
  }
  return <FeedbackScreen type={type} />;
}
