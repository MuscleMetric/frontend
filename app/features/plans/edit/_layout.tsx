import { Stack } from "expo-router";
import React from "react";
import { useAppTheme } from "../../../../../lib/useAppTheme";

export default function EditPlanLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "800",
          color: colors.text,
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Editing Plan" }} />
      <Stack.Screen name="workout" options={{ title: "Edit Workout" }} />
      <Stack.Screen name="goals" options={{ title: "Edit Goals" }} />
    </Stack>
  );
}
