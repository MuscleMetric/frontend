// app/(tabs)/user.tsx
import React from "react";
import { View } from "react-native";
import ProfileRoot from "../features/profile/layout/ProfileRoot";

export default function UserScreen() {
  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }}
    >
      <ProfileRoot />
    </View>
  );
}