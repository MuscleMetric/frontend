// app/features/_layout.tsx
import { Stack } from "expo-router";

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "center",
        headerBackTitle: "",      // hide the back label text
        headerBackVisible: true,  // show the chevron
        headerTintColor: "#111827",
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerShadowVisible: false,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="goals/goals" options={{ title: "Plan Goals" }} />
      <Stack.Screen name="achievements/achievements" options={{ title: "Achievements" }} />
      {/* add more feature screens here */}
    </Stack>
  );
}