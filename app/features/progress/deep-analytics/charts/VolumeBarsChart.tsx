import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "@/lib/useAppTheme";
import type { DeepAnalyticsPayload } from "../types";
import { formatVolume, shortLabel } from "../utils/deepAnalyticsFormat";

type Props = {
  data: DeepAnalyticsPayload["charts"]["volume_trend"];
  height?: number;
};

const WIDTH = 320;
const PADDING_X = 28;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 32;

export function VolumeBarsChart({ data, height = 180 }: Props) {
  const { colors, typography } = useAppTheme();

  const chart = useMemo(() => {
    const points = data.filter((p) => Number.isFinite(p.volume));

    if (points.length === 0) return null;

    const max = Math.max(...points.map((p) => p.volume), 1);
    const innerWidth = WIDTH - PADDING_X * 2;
    const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;
    const gap = 6;
    const barWidth = Math.max(8, (innerWidth - gap * (points.length - 1)) / points.length);

    return {
      points,
      max,
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
          Not enough volume data yet
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
        Peak {formatVolume(chart.max)}
      </SvgText>

      {chart.points.map((point, index) => {
        const barHeight = chart.barHeight(point.volume);
        const x = chart.x(index);
        const y = height - PADDING_BOTTOM - barHeight;

        return (
          <Rect
            key={`${point.date}-${index}`}
            x={x}
            y={y}
            width={chart.barWidth}
            height={barHeight}
            rx={5}
            fill={colors.primary}
          />
        );
      })}

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
    </Svg>
  );
}