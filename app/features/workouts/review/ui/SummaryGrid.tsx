// app/features/workouts/live/review/ui/SummaryGrid.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { ReviewSummary } from "../reviewTypes";

function SummaryCard(props: { label: string; value: string; suffix?: string }) {
  const { colors, typography } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface ?? colors.bg,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 6,
      }}
    >
      <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: 11, letterSpacing: 0.6 }}>
        {props.label.toUpperCase()}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: 26, letterSpacing: -0.6 }}>
          {props.value}
        </Text>
        {props.suffix ? (
          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: 13, marginBottom: 3 }}>
            {props.suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function SummaryGrid(props: { summary: ReviewSummary }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SummaryCard label="Duration" value={props.summary.durationText} />
        <SummaryCard label="Exercises" value={String(props.summary.exercisesTotal)} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SummaryCard label="Sets" value={String(props.summary.setsCompleted)} />
        <SummaryCard label="Volume" value={props.summary.volumeText} suffix="kg" />
      </View>
    </View>
  );
}
