// app/components/RingProgress.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

type Props = {
  size: number;          // total width/height in px
  stroke: number;        // ring thickness
  progress: number;      // 0–1
  label?: string;        // text inside the ring
  color?: string;        // progress colour
  trackColor?: string;   // background ring colour
};

export function RingProgress({
  size,
  stroke,
  progress,
  label,
  color = "#22c55e",            // default green-ish
  trackColor = "rgba(255,255,255,0.08)", // subtle default
}: Props) {
  const { radius, circumference, clamped } = useMemo(() => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, progress)); // clamp 0–1
    return { radius: r, circumference: c, clamped: p };
  }, [size, stroke, progress]);

  const strokeDashoffset = circumference * (1 - clamped);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Rotate so 0 starts at 12 o'clock instead of 3 o'clock */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="transparent"
          />
          {/* Progress arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Center label */}
      {label !== undefined && label !== null && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  labelText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
