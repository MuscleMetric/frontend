import React from "react";
import { Stack } from "expo-router";

export default function SocialStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // we render our own header inside screens for now
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      {/* Feed */}
      <Stack.Screen name="index" />

      {/* Search */}
      <Stack.Screen name="search" />

      {/* Profile modal */}
      <Stack.Screen
        name="profile/[id]"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}