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
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="goals" options={{ title: "Goals" }} />
      <Stack.Screen name="achievements" options={{ title: "Achievements" }} />
      {/* Add more feature screens here as you build them */}
    </Stack>
  );
}
