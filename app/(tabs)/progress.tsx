import React from "react";
import { View } from "react-native";
import { ProgressScreen } from "@/app/features/progress";
import { useAuth } from "@/lib/authContext";

export default function ProgressRoute() {
  const auth = useAuth();

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }}
    >
      <ProgressScreen />
    </View>
  );
}