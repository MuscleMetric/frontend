import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { niceCeil, niceFloor, ticks } from "../utils/deepAnalyticsMath";

type Props = {
  data: DeepAnalyticsPayload["charts"]["weight_vs_reps"];
  estimated1rm?: number | null;
  height?: number;
};

const WIDTH = 320;
const PADDING_X = 34;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 34;

function epleyWeightForReps(e1rm: number, reps: number) {
  return e1rm / (1 + reps / 30);
}

export function WeightVsRepsScatterChart({
  data,
  estimated1rm,
  height = 190,
}: Props) {
  const { colors, typography } = useAppTheme();

  const chart = useMemo(() => {
    const points = data.filter(
      (p) => Number.isFinite(p.reps) && Number.isFinite(p.weight_kg),
    );

    const hasEstimate =
      Number.isFinite(Number(estimated1rm)) && Number(estimated1rm) > 0;

    if (points.length === 0 && !hasEstimate) return null;

    const maxLoggedReps =
      points.length > 0 ? Math.max(...points.map((p) => p.reps)) : 1;

    const curveRepsMin = 1;
    const curveRepsMax = Math.max(1, Math.round(maxLoggedReps));

    const repsMin =
      points.length > 0
        ? Math.max(0, Math.min(...points.map((p) => p.reps), curveRepsMin) - 1)
        : curveRepsMin;

    const repsMax =
      points.length > 0
        ? Math.max(...points.map((p) => p.reps), curveRepsMax) + 1
        : curveRepsMax;

    const e1rmCurve = hasEstimate
      ? Array.from({ length: curveRepsMax - curveRepsMin + 1 }, (_, i) => {
          const reps = curveRepsMin + i;

          return {
            reps,
            weight: epleyWeightForReps(Number(estimated1rm), reps),
          };
        })
      : [];

    const allWeights = [
      ...points.map((p) => p.weight_kg),
      ...e1rmCurve.map((p) => p.weight),
    ].filter(Number.isFinite);

    if (allWeights.length === 0) return null;

    const weightMin = niceFloor(Math.min(...allWeights));
    const weightMax = niceCeil(Math.max(...allWeights));
    const safeWeightMax = weightMin === weightMax ? weightMax + 10 : weightMax;

    const innerWidth = WIDTH - PADDING_X * 2;
    const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;

    const x = (reps: number) =>
      PADDING_X + ((reps - repsMin) / (repsMax - repsMin)) * innerWidth;

    const y = (weight: number) =>
      PADDING_TOP +
      ((safeWeightMax - weight) / (safeWeightMax - weightMin)) * innerHeight;

    return {
      points,
      e1rmCurve,
      repsMin,
      repsMax,
      weightMin,
      weightMax: safeWeightMax,
      x,
      y,
      yTicks: ticks(weightMin, safeWeightMax, 4),
    };
  }, [data, estimated1rm, height]);

  if (!chart) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: typography.fontFamily.regular,
          }}
        >
          Not enough set data yet
        </Text>
      </View>
    );
  }

  const curvePath =
    chart.e1rmCurve.length > 1
      ? chart.e1rmCurve
          .map((point, index) => {
            const cmd = index === 0 ? "M" : "L";
            return `${cmd} ${chart.x(point.reps)} ${chart.y(point.weight)}`;
          })
          .join(" ")
      : "";

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

      {curvePath ? (
        <Path
          d={curvePath}
          stroke={colors.textMuted}
          strokeWidth={2}
          strokeDasharray="5 5"
          fill="none"
          opacity={0.75}
        />
      ) : null}

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
        {Math.round(chart.repsMin)} reps
      </SvgText>

      <SvgText
        x={WIDTH - PADDING_X - 12}
        y={height - 10}
        fontSize={10}
        fill={colors.textMuted}
        textAnchor="start"
      >
        {Math.round(chart.repsMax)} reps
      </SvgText>
    </Svg>
  );
}
