// app/features/history/ui/HistoryEmptyState.tsx
import React from "react";
import { View, Text } from "react-native";
import { Button, Card, Icon } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";

export function HistoryEmptyState({
  onStartWorkout,
}: {
  onStartWorkout: () => void;
}) {
  const { colors, typography } = useAppTheme();

  return (
    <Card style={{ padding: 14, borderRadius: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(37,99,235,0.14)",
            borderWidth: 1,
            borderColor: "rgba(37,99,235,0.22)",
          }}
        >
          <Icon name="time-outline" size={22} color={colors.primary} />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 16,
            }}
          >
            No workout history yet
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: 13 }}>
            Complete your first workout to start building trends, PRs, and insights.
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <Button title="Start a workout" onPress={onStartWorkout} />
      </View>
    </Card>
  );
}
