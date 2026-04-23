import React from "react";
import { View } from "react-native";
import { SocialScreen } from "@/app/features/social";

export default function SocialRoute() {
  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }}
    >
      <SocialScreen />
    </View>
  );
}