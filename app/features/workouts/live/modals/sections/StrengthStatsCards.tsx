// live/modals/sections/StrengthStatsCards.tsx
import React from "react";
import { View, Text } from "react-native";
import { fmtKg } from "../helpers/format";

export function StrengthStatsCards(props: {
  colors: any;
  typography: any;
  sessionVolume: number;
  bestNow: { weight: number; reps: number } | null;
  bestE1rm: number | null;
  prDelta: number | null;
}) {
  const { colors, typography } = props;

  return (
    <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 6 }}>
      <View
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface ?? colors.bg,
          borderRadius: 18,
          padding: 14,
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: typography.size.sub }}>Session Vol</Text>
        <Text
          style={{
            marginTop: 8,
            fontFamily: typography.fontFamily.bold,
            fontSize: 26,
            color: colors.text,
          }}
        >
          {Math.round(props.sessionVolume)} kg
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface ?? colors.bg,
          borderRadius: 18,
          padding: 14,
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: typography.size.sub }}>Best PR</Text>

        <Text
          style={{
            marginTop: 8,
            fontFamily: typography.fontFamily.bold,
            fontSize: 18,
            color: colors.text,
          }}
          numberOfLines={1}
        >
          {props.bestNow ? `${fmtKg(props.bestNow.weight)} × ${props.bestNow.reps}` : "—"}
        </Text>

        <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: typography.size.sub }}>
          {props.bestE1rm
            ? props.prDelta != null
              ? props.prDelta > 0
                ? `+${Math.round(props.prDelta)}kg to est 1RM`
                : `vs best`
              : `vs best`
            : "no history"}
        </Text>
      </View>
    </View>
  );
}
