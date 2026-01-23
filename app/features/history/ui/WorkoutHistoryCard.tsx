// app/features/history/ui/WorkoutHistoryCard.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Card, Icon } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { Insight, InsightChip } from "./InsightChip";

export type WorkoutHistoryCardItem = {
  workout_history_id: string;
  title: string;
  completed_at: string;
  duration_seconds?: number | null;

  // from backend
  pr_count?: number | null;
  volume_kg?: number | null;

  top_items?: {
    exercise_id: string;
    exercise_name: string;
    summary?: string | null;
    is_pr?: boolean;
  }[];

  insight?: Insight | null;
};

function fmtDayTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function fmtMins(sec?: number | null) {
  if (!sec || !isFinite(sec)) return null;
  return `${Math.max(1, Math.round(sec / 60))}m`;
}

function n0(x?: number | null) {
  if (x == null || !isFinite(x)) return null;
  return Math.round(x).toLocaleString("en-GB");
}

export function WorkoutHistoryCard({
  w,
  onPress,
}: {
  w: WorkoutHistoryCardItem;
  onPress: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const mins = fmtMins(w.duration_seconds);
  const prCount = w.pr_count ?? 0;
  const vol = n0(w.volume_kg);

  const preview = (w.top_items ?? [])
    .slice(0, 4)
    .map((x) => x.exercise_name)
    .join(" • ");

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <Card
        style={{
          padding: 14,
          borderRadius: 18,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {/* title row */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 17,
                  fontFamily: typography.fontFamily.bold,
                  letterSpacing: -0.2,
                }}
              >
                {w.title}
              </Text>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </View>

            <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 13 }}>
              {fmtDayTime(w.completed_at)}
            </Text>
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

        {/* chips row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
          {prCount > 0 ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "rgba(34,197,94,0.12)",
                borderWidth: 1,
                borderColor: "rgba(34,197,94,0.18)",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>
                🏆 {prCount} PR{prCount === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}

          {vol ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "rgba(59,130,246,0.10)",
                borderWidth: 1,
                borderColor: "rgba(59,130,246,0.16)",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12 }}>Volume: {vol}kg</Text>
            </View>
          ) : null}
        </View>

        {/* optional insight */}
        {w.insight?.label ? <InsightChip insight={w.insight} /> : null}

        {/* preview */}
        {preview ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 10,
              color: colors.textMuted,
              fontSize: 13,
            }}
          >
            {preview}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
