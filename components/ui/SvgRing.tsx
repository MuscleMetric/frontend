import React from "react";
import Svg, { Circle } from "react-native-svg";

export function SvgRing({
  size = 100,
  strokeWidth = 10,
  progress = 0,
  trackColor,
  progressColor,
}: {
  size?: number; strokeWidth?: number; progress?: number;
  trackColor: string; progressColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const over = progress > 1;
  const clamped = Math.max(0, Math.min(1, progress));
  const dash = circumference * clamped;
  const gap = circumference - dash;

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={cx} cy={cy} r={radius} stroke={over ? progressColor : progressColor}
        strokeWidth={strokeWidth} fill="none"
        strokeDasharray={`${dash},${gap}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}
