import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { formatKg, shortLabel } from "../utils/deepAnalyticsFormat";
import { niceCeil, niceFloor, ticks } from "../utils/deepAnalyticsMath";

type Props = {
  data: DeepAnalyticsPayload["charts"]["progress_over_time"];
  height?: number;
};

const WIDTH = 320;
const PADDING_X = 34;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 34;

export function StrengthOverTimeChart({ data = [], height = 180 }: Props) {
  const { colors, typography } = useAppTheme();

  const chart = useMemo(() => {
    const points = data
      .filter((p) => Number.isFinite(p.top_e1rm))
      .map((p) => ({
        date: p.date,
        value: p.top_e1rm,
      }));

    if (points.length === 0) return null;

    const values = points.map((p) => p.value);
    const min = niceFloor(Math.min(...values));
    const max = niceCeil(Math.max(...values));
    const safeMax = min === max ? max + 10 : max;

    const innerWidth = WIDTH - PADDING_X * 2;
    const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;

    const x = (index: number) =>
      PADDING_X + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);

    const y = (value: number) =>
      PADDING_TOP + ((safeMax - value) / (safeMax - min)) * innerHeight;

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`)
      .join(" ");

    return {
      points,
      min,
      max: safeMax,
      x,
      y,
      path,
      yTicks: ticks(min, safeMax, 4),
    };
  }, [data, height]);

  if (!chart) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.regular }}>
          Not enough data yet
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

      <Path d={chart.path} fill="none" stroke={colors.primary} strokeWidth={3} />

      {chart.points.map((point, index) => (
        <Circle
          key={`${point.date}-${index}`}
          cx={chart.x(index)}
          cy={chart.y(point.value)}
          r={4}
          fill={colors.primary}
        />
      ))}

      {chart.points.length > 0 && (
        <>
          <SvgText
            x={PADDING_X}
            y={height - 10}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="start"
          >
            {shortLabel(chart.points[0].date)}
          </SvgText>

          <SvgText
            x={WIDTH - PADDING_X}
            y={height - 10}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {shortLabel(chart.points[chart.points.length - 1].date)}
          </SvgText>
        </>
      )}

      <SvgText
        x={WIDTH - PADDING_X}
        y={PADDING_TOP}
        fontSize={11}
        fill={colors.textMuted}
        textAnchor="end"
      >
        {formatKg(chart.points[chart.points.length - 1].value)}
      </SvgText>
    </Svg>
  );
}