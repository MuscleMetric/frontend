import React from "react";
import { Text, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { WeightVsRepsScatterChart } from "../charts/WeightVsRepsScatterChart";

type Props = {
  payload: DeepAnalyticsPayload;
};

function formatKg(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}kg`;
}

export function WeightVsRepsSection({ payload }: Props) {
  const { colors, typography, layout } = useAppTheme();

  const estimated1rm = payload.cards.best_set?.e1rm ?? null;

  return (
    <View
      style={{
        padding: layout.space.lg,
        borderRadius: layout.radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: layout.space.md,
      }}
    >
      <View style={{ gap: layout.space.xs }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fontFamily.bold,
            fontSize: 18,
          }}
        >
          Weight, reps & estimated strength
        </Text>

        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.regular,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          Shows logged sets against an estimated strength reference line.
        </Text>
      </View>

      <WeightVsRepsScatterChart
        data={payload.charts.weight_vs_reps}
        estimated1rm={estimated1rm}
      />

      {Number.isFinite(Number(estimated1rm)) && Number(estimated1rm) > 0 ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: layout.radius.lg,
            padding: layout.space.md,
            backgroundColor: colors.bg,
            gap: 4,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.semibold,
              fontSize: 13,
            }}
          >
            Equivalent estimated strength
          </Text>

          <Text
            style={{
              color: colors.textMuted,
              fontFamily: typography.fontFamily.regular,
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            The dashed line shows weight and rep combinations that would produce
            a similar estimated 1RM of approximately {formatKg(estimated1rm)}{" "}
            using the Epley formula. Sets closer to the line represent a similar
            estimated strength value, even if the logged weight and reps are
            different.
          </Text>
        </View>
      ) : null}
    </View>
  );
}