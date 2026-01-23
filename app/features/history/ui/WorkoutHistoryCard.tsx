// app/features/history/ui/WorkoutHistoryCard.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Card, Icon } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { Insight, InsightChip } from "./InsightChip";
import { WorkoutHistoryExerciseRow } from "./WorkoutHistoryExerciseRow";

export type WorkoutHistoryCardItem = {
  workout_history_id: string;
  title: string;
  completed_at: string;
  duration_seconds?: number | null;

  // from backend
  top_items?: {
    exercise_id: string;
    exercise_name: string;
    summary?: string | null;

    // optional: if backend returns PR hits for session
    is_pr?: boolean;
  }[];

  insight?: Insight | null;
};

function fmtDay(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtMins(sec?: number | null) {
  if (!sec || !isFinite(sec)) return null;
  return `${Math.max(1, Math.round(sec / 60))}m`;
}

export function WorkoutHistoryCard({
  w,
  onPress,
  width = 320,
  variantLabel = "WORKOUT",
}: {
  w: WorkoutHistoryCardItem;
  onPress: () => void;
  width?: number;
  variantLabel?: string;
}) {
  const { colors, typography } = useAppTheme();
  const mins = fmtMins(w.duration_seconds);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <Card
        style={{
          width,
          padding: 14,
          borderRadius: 22,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {/* top */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                letterSpacing: 0.6,
                fontFamily: typography.fontFamily.semibold,
              }}
            >
              {variantLabel}
            </Text>

            {/* title + chevron inline */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 22,
                  fontFamily: typography.fontFamily.bold,
                  letterSpacing: -0.2,
                }}
              >
                {w.title}
              </Text>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </View>

          {mins ? (
            <View
              style={{
                marginLeft: 10,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>{mins}</Text>
            </View>
          ) : null}
        </View>

        {/* date */}
        <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
          {fmtDay(w.completed_at)}
        </Text>

        {/* insight */}
        {w.insight?.label ? <InsightChip insight={w.insight} /> : null}

        {/* exercises */}
        <View style={{ marginTop: 12, gap: 10 }}>
          {(w.top_items ?? []).slice(0, 4).map((it) => (
            <WorkoutHistoryExerciseRow
              key={it.exercise_id}
              name={it.exercise_name}
              summary={it.summary}
              isPr={!!it.is_pr}
            />
          ))}
        </View>
      </Card>
    </Pressable>
  );
}
