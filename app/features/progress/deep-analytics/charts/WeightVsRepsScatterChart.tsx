import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { niceCeil, niceFloor, ticks } from "../utils/deepAnalyticsMath";

type Props = {
  data: DeepAnalyticsPayload["charts"]["weight_vs_reps"];
  height?: number;
};

const WIDTH = 320;
const PADDING_X = 34;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 34;

export function WeightVsRepsScatterChart({ data, height = 190 }: Props) {
  const { colors, typography } = useAppTheme();

  const chart = useMemo(() => {
    const points = data.filter(
      (p) => Number.isFinite(p.reps) && Number.isFinite(p.weight_kg),
    );

    if (points.length === 0) return null;

    const repsMin = Math.max(0, Math.min(...points.map((p) => p.reps)) - 1);
    const repsMax = Math.max(...points.map((p) => p.reps)) + 1;

    const weightMin = niceFloor(Math.min(...points.map((p) => p.weight_kg)));
    const weightMax = niceCeil(Math.max(...points.map((p) => p.weight_kg)));
    const safeWeightMax = weightMin === weightMax ? weightMax + 10 : weightMax;

    const innerWidth = WIDTH - PADDING_X * 2;
    const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;

    const x = (reps: number) =>
      PADDING_X + ((reps - repsMin) / (repsMax - repsMin)) * innerWidth;

    const y = (weight: number) =>
      PADDING_TOP + ((safeWeightMax - weight) / (safeWeightMax - weightMin)) * innerHeight;

    return {
      points,
      repsMin,
      repsMax,
      weightMin,
      weightMax: safeWeightMax,
      x,
      y,
      yTicks: ticks(weightMin, safeWeightMax, 4),
    };
  }, [data, height]);

  if (!chart) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.regular }}>
          Not enough set data yet
        </Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
      {chart.yTicks.map((tick) => {
        const y = chart.y(tick);

        return (
          <React.Fragment key={tick}>
            <Line
              x1={PADDING_X}
              x2={WIDTH - PADDING_X}
              y1={y}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
            />
            <SvgText
              x={PADDING_X - 8}
              y={y + 4}
              fontSize={10}
              fill={colors.textMuted}
              textAnchor="end"
            >
              {Math.round(tick)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {chart.points.map((point, index) => (
        <Circle
          key={`${point.completed_at}-${index}`}
          cx={chart.x(point.reps)}
          cy={chart.y(point.weight_kg)}
          r={4}
          fill={colors.primary}
          opacity={0.82}
        />
      ))}

      <SvgText
        x={PADDING_X}
        y={height - 10}
        fontSize={10}
        fill={colors.textMuted}
        textAnchor="start"
      >
        {chart.repsMin} reps
      </SvgText>

      <SvgText
        x={WIDTH - PADDING_X}
        y={height - 10}
        fontSize={10}
        fill={colors.textMuted}
        textAnchor="end"
      >
        {chart.repsMax} reps
      </SvgText>
    </Svg>
  );
}