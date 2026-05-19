import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";

type Props = {
  data: DeepAnalyticsPayload["charts"]["set_contribution"];
  height?: number;
};

const WIDTH = 320;
const PADDING_X = 28;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 34;

export function SetContributionBarsChart({ data, height = 170 }: Props) {
  const { colors, typography } = useAppTheme();

  const chart = useMemo(() => {
    const points = data.filter((p) => Number.isFinite(p.volume));

    if (points.length === 0) return null;

    const max = Math.max(...points.map((p) => p.volume), 1);
    const total = points.reduce((sum, p) => sum + p.volume, 0);

    const innerWidth = WIDTH - PADDING_X * 2;
    const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;
    const gap = 6;
    const barWidth = Math.max(8, (innerWidth - gap * (points.length - 1)) / points.length);

    return {
      points,
      max,
      total,
      innerHeight,
      barWidth,
      gap,
      x: (index: number) => PADDING_X + index * (barWidth + gap),
      barHeight: (value: number) => (value / max) * innerHeight,
    };
  }, [data, height]);

  if (!chart) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.regular }}>
          Not enough set contribution data yet
        </Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
      <SvgText
        x={WIDTH - PADDING_X}
        y={PADDING_TOP}
        fontSize={11}
        fill={colors.textMuted}
        textAnchor="end"
      >
        Total {Math.round(chart.total).toLocaleString("en-GB")}kg
      </SvgText>

      {chart.points.map((point, index) => {
        const barHeight = chart.barHeight(point.volume);
        const x = chart.x(index);
        const y = height - PADDING_BOTTOM - barHeight;

        return (
          <React.Fragment key={point.set_id}>
            <Rect
              x={x}
              y={y}
              width={chart.barWidth}
              height={barHeight}
              rx={5}
              fill={colors.primary}
            />
            <SvgText
              x={x + chart.barWidth / 2}
              y={height - 13}
              fontSize={9}
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {point.set_number}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}