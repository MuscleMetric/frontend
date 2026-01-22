import React, { useMemo } from "react";
import { Text, View, ScrollView, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";
import { formatKg } from "../data/progress.mapper";

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function fmtDeltaAbs(delta: number | null | undefined) {
  if (delta == null) return "NEW PR";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}kg`;
}

export default function StrengthHighlightsSection({
  highlights,
  onOpenExercise,
}: {
  highlights: ProgressOverview["highlights"];
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { colors } = useAppTheme();

  const cards = highlights.cards ?? [];

  return (
    <ProgressSection>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <View>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
            Strength highlights
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: 13 }}>
            Recent achievements
          </Text>
        </View>
        {/* optional: add View All later */}
      </View>

      {!cards.length ? (
        <Text style={{ color: colors.textMuted }}>
          Log more workouts to unlock PR highlights.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 6 }}
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            {cards.map((c) => (
              <Pressable
                key={c.exercise_id}
                onPress={() => onOpenExercise(c.exercise_id)}
                style={{
                  width: 260,
                  backgroundColor: colors.surface,
                  borderRadius: 22,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {/* top row: delta */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor:
                        c.delta_abs != null && c.delta_abs > 0
                          ? (colors.success ?? colors.primary) + "1A"
                          : colors.surface,
                      borderWidth: 1,
                      borderColor:
                        c.delta_abs != null && c.delta_abs > 0
                          ? (colors.success ?? colors.primary) + "55"
                          : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          c.delta_abs != null && c.delta_abs > 0
                            ? (colors.success ?? colors.primary)
                            : colors.textMuted,
                        fontWeight: "900",
                        fontSize: 12,
                      }}
                    >
                      {fmtDeltaAbs(c.delta_abs)}
                    </Text>
                  </View>
                </View>

                {/* exercise name */}
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 16,
                    marginBottom: 6,
                  }}
                >
                  {c.exercise_name}
                </Text>

                {/* big e1rm */}
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 38,
                      letterSpacing: -0.6,
                      lineHeight: 40,
                    }}
                  >
                    {c.e1rm.toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      color: colors.textMuted,
                      marginLeft: 6,
                      fontSize: 14,
                      fontWeight: "800",
                    }}
                  >
                    kg Estimated 1 Rep Max
                  </Text>
                </View>

                {/* set that caused it */}
                <Text style={{ color: colors.textMuted, marginTop: 6 }}>
                  {formatKg(c.best_weight)} × {c.best_reps}
                </Text>

                {/* footer */}
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    • Lifetime Best • {fmtDateShort(c.achieved_at)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </ProgressSection>
  );
}
