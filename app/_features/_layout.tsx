// app/features/_layout.tsx
import { Stack } from "expo-router";

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "", 
        headerBackVisible: true, 
        headerTintColor: "#111827",
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerShadowVisible: false,
        gestureEnabled: true, // enables iOS swipe back
      }}
    >
      <Stack.Screen name="achievements" options={{ title: "Achievements" }} />
      {/* Add future pages here (Goals, Plan Details, etc.) */}
    </Stack>
  );
}
