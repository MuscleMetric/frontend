import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SvgRing } from "../ui/SvgRing";

export function StatsRings({
  colors,
  steps,
  stepsGoal,
  workouts,
  workoutGoal,
  volume,
  volumeLastWeek,
}: {
  colors: any;
  steps: number;
  stepsGoal: number;
  workouts: number;
  workoutGoal: number;
  volume: number;
  volumeLastWeek: number;
}) {
  const s = styles(colors);

  // raw percents (can exceed 1)
  const stepsPct = stepsGoal > 0 ? steps / stepsGoal : 0;
  const workoutsPct = workoutGoal > 0 ? workouts / workoutGoal : 0;
  const volumePct =
    volumeLastWeek > 0 ? volume / volumeLastWeek : volume > 0 ? 1 : 0;

  // shared color logic by percent
  function colorFor(pct: number) {
    if (pct >= 1) return { ring: colors.successText, text: colors.successText };
    if (pct >= 0.5) return { ring: colors.warnText, text: colors.warnText };
    return { ring: colors.danger, text: colors.danger };
  }

  const Ring = ({
    label,
    goalText,
    percent,
    value,
    track,
    fallbackProg,
  }: {
    label: string;
    goalText: string;
    percent: number; // can exceed 1
    value: string; // main value line(s)
    track: string;
    fallbackProg: string; // used if you want to force a color; otherwise dynamic
  }) => {
    const pct = Math.max(0, percent);
    const pctInt = Math.round(pct * 100);
    const center = pctInt > 100 ? `+${pctInt - 100}%` : `${pctInt}%`;
    const { ring, text } = colorFor(pct);
    const progressColor = pct >= 1 || pct >= 0.5 ? ring : fallbackProg;

    // inside Ring()
    return (
      <View style={s.col}>
        <View style={s.ringBox}>
          <SvgRing
            size={100}
            strokeWidth={10}
            progress={pct}
            trackColor={track}
            progressColor={progressColor}
          />
          {/* Centered percent text */}
          <View style={s.centerWrap}>
            <Text style={[s.centerText, { color: text }]}>{center}</Text>
          </View>
        </View>

        <Text style={s.label}>{label}</Text>
        <Text style={s.goal}>{goalText}</Text>
        <Text style={s.value}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={s.card}>
      <View style={s.row}>
        <Ring
          label="STEPS"
          goalText={`Daily goal ${Intl.NumberFormat().format(stepsGoal)}`}
          percent={stepsPct}
          value={`${Intl.NumberFormat().format(steps)}`}
          track={colors.primaryBg}
          fallbackProg={colors.primary}
        />

        <Ring
          label="WORKOUTS"
          goalText={`Weekly goal ${workoutGoal}`}
          percent={workoutsPct}
          value={`${workouts}`}
          track={colors.successBg}
          fallbackProg={colors.successText}
        />

        <Ring
          label="VOLUME"
          goalText={`Vs last week`}
          percent={volumePct}
          value={`${Intl.NumberFormat().format(volume)} kg`}
          track={colors.warnBg}
          fallbackProg={colors.warnText}
        />
      </View>
    </View>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    col: {
      width: "32%", // three equal columns
      alignItems: "center",
    },
    label: {
      color: colors.text,
      fontWeight: "800" as const,
      letterSpacing: 1.2,
      marginTop: 10, // more spacing under the ring
      textAlign: "center",
    },
    goal: {
      marginTop: 2,
      color: colors.subtle,
      fontSize: 12,
      textAlign: "center",
    },
    value: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800" as const,
      textAlign: "center",
      marginTop: 8,
    },
    ringBox: {
      width: 100,
      height: 100,
      position: "relative", // important so the overlay anchors to this box
    },
    centerWrap: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
    },
    centerText: {
      fontWeight: "900" as const,
      fontSize: 18,
      textAlign: "center",
    },
  });
