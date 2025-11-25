// app/_components/ringprogress.tsx
import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useAppTheme } from "../../../lib/useAppTheme";

type Props = {
  size: number;
  stroke: number;
  /** 0–1 */
  progress: number;
  label?: string;
  /** Optional override, falls back to theme success color */
  color?: string;
};

export default function RingProgress({
  size,
  stroke,
  progress,
  label,
  color,
}: Props) {
  const { colors } = useAppTheme();

  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * clamped;
  const ringColor = color ?? colors.successText;

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}
      accessibilityLabel={label}
    >
      <Svg width={size} height={size}>
        {/* track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        {/* progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ringColor}
          strokeWidth={stroke}
          strokeDasharray={`${dash}, ${c - dash}`}
          strokeLinecap="round"
          fill="none"
          // start at 12 o'clock
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {label ? (
        <Text style={{ position: "absolute", fontWeight: "800", color: colors.text }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
