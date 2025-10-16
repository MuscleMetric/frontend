// app/features/_layout.tsx
import { Stack } from "expo-router";

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // 🔥 hide all headers
        gestureEnabled: true, // still allow iOS swipe back
      }}
    >
      <Stack.Screen name="goals/goals" />
      <Stack.Screen name="achievements/achievements" />
      <Stack.Screen name="plans/create" />
    </Stack>
  );
}
