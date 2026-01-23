// app/features/history/ui/WorkoutHistoryExerciseRow.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { PRBadge } from "./PRBadge";

export function WorkoutHistoryExerciseRow({
  name,
  summary,
  isPr,
  isBest,
}: {
  name: string;
  summary?: string | null;
  isPr?: boolean;
  isBest?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: colors.text,
            fontSize: 15,
          }}
        >
          {name}
        </Text>
      </View>

      {summary ? (
        <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 10 }}>
          {summary}
        </Text>
      ) : null}
    </View>
  );
}
