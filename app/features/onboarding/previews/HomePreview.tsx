import React from "react";
import { View } from "react-native";
import { HomeScreen } from "../../home/HomeScreen";
import { mockHomeSummary } from "./mockHomeSummary";

export function HomePreview() {
  return (
    <View style={{ paddingTop: 6 }}>
      <HomeScreen summary={mockHomeSummary} userId={"demo-user"} />
    </View>
  );
}
