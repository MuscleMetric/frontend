// app/features/workouts/components/CoachsTipCard.tsx

import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { getCoachTipForToday } from "../data/coachTips";

export function CoachsTipCard({
  userId,
  tip,
}: {
  userId?: string | null;
  tip?: string | null; // allow override if you ever want to pass one in
}) {
  const { colors, typography, layout } = useAppTheme();

  const text = tip?.trim() || getCoachTipForToday({ userId });

  if (!text) return null;

  return (
    <View
      style={{
        backgroundColor: colors.trackBg,
        borderColor: colors.trackBorder,
        borderWidth: 1,
        borderRadius: layout.radius.lg,
        padding: layout.space.md,
      }}
    >
      <Text
        style={{
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.text,
        }}
      >
        Coach’s Tip:{" "}
        <Text
          style={{
            fontFamily: typography.fontFamily.regular,
            color: colors.text,
          }}
        >
          {text}
        </Text>
      </Text>
    </View>
  );
}
