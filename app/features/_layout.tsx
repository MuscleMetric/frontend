// app/features/_layout.tsx
import { Stack } from "expo-router";
import React from "react";

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, 
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="goals/goals" />
      <Stack.Screen name="achievements/achievements" />
      <Stack.Screen name="plans/create" />
    </Stack>
  );
}
