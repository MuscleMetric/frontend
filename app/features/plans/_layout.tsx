// app/features/plans/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function PlansLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // 🔥 No headers anywhere in plan creation
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="create/planInfo" />
      <Stack.Screen name="create/workout" />
      <Stack.Screen name="create/goals" />
      <Stack.Screen name="create/review" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="history/view" />
      <Stack.Screen name="history/all" />
    </Stack>
  );
}
