import React from "react";
import { View } from "react-native";
import { Screen, ScreenHeader, Card } from "@/ui";

export default function ProgressSkeleton() {
  return (
    <Screen>
      <ScreenHeader title="Progress" />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Card><View style={{ height: 96 }} /></Card>
        <Card><View style={{ height: 140 }} /></Card>
        <Card><View style={{ height: 140 }} /></Card>
        <Card><View style={{ height: 120 }} /></Card>
        <Card><View style={{ height: 140 }} /></Card>
      </View>
    </Screen>
  );
}
