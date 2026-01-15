// app/features/workouts/live/ui/LiveWorkoutExerciseRow.tsx
import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { LiveExerciseDraft } from "../state/types";
import { getExerciseCtaLabel, isExerciseComplete, hasSetData } from "../state/selectors";

function fmtNum(n: number, dp = 0) {
  if (dp === 0) return `${Math.round(n)}`;
  return n.toFixed(dp);
}

function formatSetLine(ex: LiveExerciseDraft, setNumber: number) {
  const type = (ex.type ?? "").toLowerCase();
  const s = ex.sets.find((x) => x.setNumber === setNumber);
  if (!s) return null;
  if (!hasSetData(ex, s)) return null;

  if (type === "cardio") {
    const parts: string[] = [];
    if (s.distance != null) parts.push(`${fmtNum(s.distance, 2)}km`);
    if (s.timeSeconds != null) parts.push(`${fmtNum(s.timeSeconds)}s`);
    if (!parts.length) return null;
    return `${setNumber}. ${parts.join(" • ")}`;
  }

  const reps = s.reps;
  const weight = s.weight;

  if (reps != null && weight != null) return `${setNumber}. ${reps} reps × ${fmtNum(weight)}kg`;
  if (reps != null) return `${setNumber}. ${reps} reps`;
  if (weight != null) return `${setNumber}. ${fmtNum(weight)}kg`;
  return null;
}

export function LiveWorkoutExerciseRow(props: {
  index: number; // 1-based display
  title: string;
  subtitle: string; // e.g. "4 sets × 12 • 7.5kg"
  tags?: string[]; // e.g. ["Superset A", "Dropset"]
  ex: LiveExerciseDraft; // ✅ source of truth (drives CTA + completion + lines)
  onPress: () => void;
}) {
  const { colors, typography } = useAppTheme();

  const complete = isExerciseComplete(props.ex);
  const cta = getExerciseCtaLabel(props.ex); // "Start" | "Continue" | "Edit"

  // ✅ match your desired pill text exactly
  const pillTextValue: "Start" | "Continue" | "Done ✓ Edit" = complete ? "Done ✓ Edit" : cta;

  const pillBorder = complete ? colors.success ?? "#22c55e" : colors.border;
  const pillBg = complete ? colors.successBg ?? "rgba(34,197,94,0.12)" : "transparent";
  const pillText = complete ? colors.success ?? "#16a34a" : colors.text;

  // ✅ build completed lines from entered set data (not a prop)
  const completedLines = useMemo(() => {
    if (!complete) return [];
    const lines: string[] = [];
    for (const s of props.ex.sets) {
      const line = formatSetLine(props.ex, s.setNumber);
      if (line) lines.push(line);
    }
    return lines;
  }, [complete, props.ex]);

  return (
    <Pressable
      onPress={props.onPress}
      style={{
        backgroundColor: colors.bg ?? colors.surface,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {/* Left index bubble */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            marginTop: 2,
          }}
        >
          <Text style={{ fontFamily: typography.fontFamily.bold, color: colors.text }}>
            {props.index}
          </Text>
        </View>

        {/* Main text */}
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text
            style={{
              fontFamily: typography.fontFamily.bold,
              fontSize: typography.size.body,
              color: colors.text,
            }}
            numberOfLines={2}
          >
            {props.title}
          </Text>

          {/* subtitle line */}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
            <Text
              style={{
                fontFamily: typography.fontFamily.regular,
                fontSize: typography.size.sub,
                color: colors.textMuted,
              }}
            >
              {props.subtitle}
            </Text>

            {!!props.tags?.length && (
              <>
                <Text style={{ color: colors.textMuted, marginHorizontal: 6 }}>•</Text>
                <Text
                  style={{
                    fontFamily: typography.fontFamily.semibold,
                    fontSize: typography.size.sub,
                    color: colors.primary,
                  }}
                >
                  {props.tags.join(" • ")}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Right pill */}
        <View
          style={{
            borderWidth: 2,
            borderColor: pillBorder,
            backgroundColor: pillBg,
            borderRadius: 999,
            paddingVertical: 8,
            paddingHorizontal: 14,
            minWidth: 112,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
          }}
        >
          <Text style={{ fontFamily: typography.fontFamily.bold, color: pillText }}>
            {pillTextValue}
          </Text>
        </View>
      </View>

      {/* Completed sets list (only once complete) */}
      {complete && completedLines.length > 0 && (
        <View style={{ marginTop: 14, paddingLeft: 46 }}>
          {completedLines.slice(0, 12).map((line) => (
            <Text
              key={line}
              style={{
                fontFamily: typography.fontFamily.regular,
                fontSize: typography.size.body,
                color: colors.text,
                marginBottom: 6,
              }}
            >
              {line}
            </Text>
          ))}
        </View>
      )}
    </Pressable>
  );
}
