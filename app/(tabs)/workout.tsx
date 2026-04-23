// app/(tabs)/workout.tsx
import React from "react";
import { View } from "react-native";
import WorkoutsHome from "../features/workouts/screens/WorkoutsHome";

export default function WorkoutScreen() {
  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }}
    >
      <WorkoutsHome />
    </View>
  );
}