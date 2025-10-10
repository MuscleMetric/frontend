import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

export default function RingProgress({
  size,
  stroke,
  progress,
  label,
  color = "#22c55e",
}: {
  size: number;
  stroke: number;
  progress: number; // 0–1
  label?: string;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * progress;

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#D8DDE4" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash}, ${c - dash}`}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
          fill="none"
        />
      </Svg>
      {label && <Text style={{ position: "absolute", fontWeight: "800" }}>{label}</Text>}
    </View>
  );
}
