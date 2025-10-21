// app/features/plans/_layout.tsx
import { Stack } from "expo-router";

export default function PlansLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerBackTitle: "",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTintColor: "#111827",
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="create/planInfo" options={{ title: "Create Plan" }} />
      <Stack.Screen name="create/workout"  options={{ title: "Workout" }} />
      <Stack.Screen name="create/goals"    options={{ title: "Goals" }} />
      <Stack.Screen name="create/review"   options={{ title: "Review" }} />
    </Stack>
  );
}
