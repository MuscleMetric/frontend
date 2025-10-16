// app/features/plans/_layout.tsx
import { Stack } from "expo-router";

export default function PlansLayout() {
  return (
    <Stack screenOptions={{
      headerTitleAlign: "center",
      headerBackTitle: "",
      headerShadowVisible: false,
      gestureEnabled: true,
    }}>
      <Stack.Screen name="create/planInfo" options={{ title: "Create Plan" }} />
      <Stack.Screen name="create/workout"  options={{ title: "Workout" }} />
      <Stack.Screen name="create/goals"    options={{ title: "Goals" }} />
      <Stack.Screen name="create/review"   options={{ title: "Review" }} />
    </Stack>
  );
}
