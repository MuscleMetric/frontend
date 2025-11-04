import React from "react";
import Svg, { Circle } from "react-native-svg";

export function MiniDonut({
  size = 56, percent = 0.3, trackColor = "#e5e7eb", progressColor = "#0b6aa9",
}: { size?: number; percent?: number; trackColor?: string; progressColor?: string; }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.max(0, Math.min(1, percent));
  const gap = circumference - dash;

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={cx} cy={cy} r={radius} stroke={progressColor} strokeWidth={strokeWidth}
        fill="none" strokeDasharray={`${dash},${gap}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}
