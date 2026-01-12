// app/features/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    />
  );
}
