// app/features/plans/_layout.tsx
import React, { useMemo } from "react";
import { Stack } from "expo-router";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useAppTheme } from "../../../lib/useAppTheme";

export default function PlansLayout() {
  const { colors } = useAppTheme();

  const screenOptions: NativeStackNavigationOptions = useMemo(
    () => ({
      headerTitleAlign: "center",
      headerBackTitleVisible: false, // native-stack compatible
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: "800", color: colors.text },
      contentStyle: { backgroundColor: colors.background },
      gestureEnabled: true,
    }),
    [colors]
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="create/planInfo" options={{ title: "Create Plan" }} />
      <Stack.Screen name="create/workout" options={{ title: "Workout" }} />
      <Stack.Screen name="create/goals" options={{ title: "Goals" }} />
      <Stack.Screen name="create/review" options={{ title: "Review" }} />
      <Stack.Screen
        name="edit"
        options={{
          headerShown: false, 
          headerTitle: "",
          headerBackTitle: "",
          headerShadowVisible: false,
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
