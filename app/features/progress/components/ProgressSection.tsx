import React from "react";
import { View } from "react-native";
import { Card } from "@/ui";

export function ProgressSection({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <View style={{ gap: 10 }}>{children}</View>
    </Card>
  );
}
