// app/features/_layout.tsx
import { Stack } from "expo-router";

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, 
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="goals/goals" />
      <Stack.Screen name="achievements/achievements" />
      <Stack.Screen name="plans/create" />
    </Stack>
  );
}
