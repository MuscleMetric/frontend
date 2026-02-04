// app/features/plans/edit/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { useAppTheme } from "../../../../lib/useAppTheme";

export default function EditPlanLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,          // ✅ key change
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="planInfo" />
      <Stack.Screen name="workouts" />
      <Stack.Screen name="workout" />
      <Stack.Screen name="goals" />
    </Stack>
  );
}
