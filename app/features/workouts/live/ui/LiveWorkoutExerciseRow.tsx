// app/features/workouts/live/ui/LiveWorkoutExerciseRow.tsx
import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { LiveExerciseDraft } from "../state/types";
import {
  getExerciseCtaLabel,
  isExerciseComplete,
  hasSetData,
} from "../state/selectors";

function fmtNum(n: number, maxDp = 2) {
  // Round to maxDp (to avoid float noise like 55.499999)
  const rounded = Number(n.toFixed(maxDp));

  // Convert back to string without forcing trailing zeros
  return rounded.toString();
}

function dropLetter(dropIndex: number) {
  // 1 -> a, 2 -> b, 3 -> c ...
  const n = Math.max(1, dropIndex);
  return String.fromCharCode("a".charCodeAt(0) + ((n - 1) % 26));
}

function formatStrength(w: number | null, r: number | null) {
  const reps = r ?? null;
  const weight = w ?? null;
  if (reps != null && weight != null)
    return `${reps} reps × ${fmtNum(weight)}kg`;
  if (reps != null) return `${reps} reps`;
  if (weight != null) return `${fmtNum(weight)}kg`;
  return "—";
}

function formatCardio(distance: number | null, timeSeconds: number | null) {
  const parts: string[] = [];
  if (distance != null) parts.push(`${fmtNum(distance, 2)}km`);
  if (timeSeconds != null) parts.push(`${fmtNum(timeSeconds)}s`);
  return parts.join(" • ") || "—";
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
  const pillTextValue: "Start" | "Continue" | "Done ✓ Edit" = complete
    ? "Done ✓ Edit"
    : cta;

  const pillBorder = complete ? colors.success ?? "#22c55e" : colors.border;
  const pillBg = complete
    ? colors.successBg ?? "rgba(34,197,94,0.12)"
    : "transparent";
  const pillText = complete ? colors.success ?? "#16a34a" : colors.text;

  // ✅ build completed lines from entered set data (not a prop)
  const completedBlocks = useMemo(() => {
    if (!complete) return [];

    const type = (props.ex.type ?? "").toLowerCase();

    // only keep rows that actually have data
    const rows = (props.ex.sets ?? [])
      .filter((s) => hasSetData(props.ex, s))
      .slice()
      .sort((a, b) => {
        if (a.setNumber !== b.setNumber) return a.setNumber - b.setNumber;
        return (a.dropIndex ?? 0) - (b.dropIndex ?? 0);
      });

    // group by setNumber
    const bySet = new Map<number, typeof rows>();
    for (const r of rows) {
      const k = r.setNumber;
      if (!bySet.has(k)) bySet.set(k, []);
      bySet.get(k)!.push(r);
    }

    return Array.from(bySet.entries()).map(([setNumber, group]) => {
      const base = group.find((x) => (x.dropIndex ?? 0) === 0) ?? null;
      const drops = group
        .filter((x) => (x.dropIndex ?? 0) > 0)
        .sort((a, b) => (a.dropIndex ?? 0) - (b.dropIndex ?? 0));

      const baseLabel =
        type === "cardio"
          ? formatCardio(base?.distance ?? null, base?.timeSeconds ?? null)
          : formatStrength(base?.weight ?? null, base?.reps ?? null);

      const dropLabels = drops.map((d) => ({
        dropIndex: d.dropIndex ?? 0,
        label:
          type === "cardio"
            ? formatCardio(d.distance ?? null, d.timeSeconds ?? null)
            : formatStrength(d.weight ?? null, d.reps ?? null),
      }));

      return { setNumber, baseLabel, dropLabels };
    });
  }, [complete, props.ex.sets, props.ex.type]);

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
          <Text
            style={{
              fontFamily: typography.fontFamily.bold,
              color: colors.text,
            }}
          >
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              marginTop: 6,
            }}
          >
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
                <Text style={{ color: colors.textMuted, marginHorizontal: 6 }}>
                  •
                </Text>
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
          <Text
            style={{ fontFamily: typography.fontFamily.bold, color: pillText }}
          >
            {pillTextValue}
          </Text>
        </View>
      </View>

      {/* Completed sets list (only once complete) */}
      {complete && completedBlocks.length > 0 && (
        <View style={{ marginTop: 14, paddingLeft: 46, gap: 10 }}>
          {completedBlocks.slice(0, 12).map((b) => (
            <View key={`set-${b.setNumber}`} style={{ gap: 6 }}>
              {/* Base set line */}
              <Text
                key={`${b.setNumber}-0`}
                style={{
                  fontFamily: typography.fontFamily.regular,
                  fontSize: typography.size.body,
                  color: colors.text,
                }}
              >
                {b.setNumber}. {b.baseLabel}
              </Text>

              {/* Drops inline, slightly indented */}
              {b.dropLabels.length > 0 && (
                <View
                  style={{
                    paddingLeft: 18,
                    flexDirection: "row",
                    flexWrap: "wrap",
                  }}
                >
                  {b.dropLabels.map((d) => (
                    <Text
                      key={`${b.setNumber}-${d.dropIndex}`}
                      style={{
                        fontFamily: typography.fontFamily.regular,
                        fontSize: typography.size.sub,
                        color: colors.textMuted,
                        marginRight: 14,
                        marginBottom: 6,
                      }}
                    >
                      {dropLetter(d.dropIndex)}. {d.label}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}
