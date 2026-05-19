import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { formatKg } from "../utils/deepAnalyticsFormat";
import { generateStatSummary } from "../utils/deepAnalyticsInsights";

type Props = {
  payload: DeepAnalyticsPayload;
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        minWidth: "30%",
        padding: layout.space.md,
        borderRadius: layout.radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: layout.space.xs,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: 12,
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 18,
        }}
      >
        {value}
      </Text>

      {sub ? (
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.regular,
            fontSize: 12,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function DeepAnalyticsStatCards({ payload }: Props) {
  const { layout } = useAppTheme();
  const stats = generateStatSummary(payload);

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: layout.space.sm,
      }}
    >
      <StatCard
        label="Current top"
        value={formatKg(stats.currentTopWeight)}
        sub={stats.currentTopSet}
      />

      <StatCard
        label="Best set"
        value={stats.bestSet}
        sub={
          stats.bestE1RM == null
            ? "No estimate yet"
            : `Est. ${formatKg(stats.bestE1RM)}`
        }
      />

      <StatCard
        label="Estimated 1RM"
        value={formatKg(payload.cards.est_1rm.value)}
        sub="Epley formula"
      />
    </View>
  );
}