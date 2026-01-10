import React from "react";
import { View } from "react-native";
import { HomeRoot } from "../../home/HomeRoot";
import { mockHomeSummary } from "./mockHomeSummary";

export function HomePreview() {
  return (
    <View style={{ paddingTop: 6 }}>
      <HomeRoot summary={mockHomeSummary} userId={"demo-user"} />
    </View>
  );
}
