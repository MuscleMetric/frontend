import React from "react";
import { View, Text } from "react-native";
import { Button, Card } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";

export default function ProgressErrorState({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <Card>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
          Couldn’t load progress
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Check your connection and try again.
        </Text>
        <View style={{ marginTop: 12 }}>
          <Button title="Retry" onPress={onRetry} />
        </View>
      </Card>
    </View>
  );
}
