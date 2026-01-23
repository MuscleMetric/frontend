import React from "react";
import { Text, View, ScrollView, Pressable } from "react-native";
import { Button, Card, Icon } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";

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

type LastWorkout = NonNullable<
  ProgressOverview["recent_activity"]
> extends infer R
  ? R extends { last_workouts: any[] }
    ? R["last_workouts"][number]
    : any
  : any;

function WorkoutMiniCard({
  w,
  onPress,
}: {
  w: LastWorkout;
  onPress: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const mins = fmtMins(w.duration_seconds);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <Card
        style={{
          width: 320,
          padding: 14,
          borderRadius: 22,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {/* top row */}
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
              LAST WORKOUT
            </Text>

            {/* title + chevron inline */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 6,
              }}
            >
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

        {/* date row */}
        <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
          {fmtDay(w.completed_at)}
        </Text>

        {/* insight chip */}
        {w.insight?.label ? (
          <View
            style={{
              marginTop: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor:
                w.insight.trend === "down"
                  ? "rgba(239,68,68,0.12)"
                  : w.insight.trend === "flat"
                  ? "rgba(148,163,184,0.12)"
                  : "rgba(34,197,94,0.12)",
              borderWidth: 1,
              borderColor:
                w.insight.trend === "down"
                  ? "rgba(239,68,68,0.18)"
                  : w.insight.trend === "flat"
                  ? "rgba(148,163,184,0.18)"
                  : "rgba(34,197,94,0.18)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Icon
                name={
                  w.insight.trend === "down"
                    ? "trending-down"
                    : w.insight.trend === "flat"
                    ? "remove"
                    : "trending-up"
                }
                size={16}
                color={
                  w.insight.trend === "down"
                    ? "rgba(239,68,68,0.9)"
                    : w.insight.trend === "flat"
                    ? "rgba(148,163,184,0.9)"
                    : "rgba(34,197,94,0.9)"
                }
              />
              <Text style={{ marginLeft: 8, color: colors.text, fontSize: 13 }}>
                {w.insight.label}
              </Text>
            </View>
          </View>
        ) : null}

        {/* exercises */}
        <View style={{ marginTop: 12, gap: 10 }}>
          {(w.top_items ?? []).slice(0, 4).map((it: any) => (
            <View
              key={it.exercise_id}
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 15,
                }}
              >
                {it.exercise_name}
              </Text>

              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 14,
                  marginLeft: 10,
                }}
              >
                {it.summary}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

export default function RecentActivitySection({
  recent,
  onOpenHistory,
  onOpenWorkoutHistoryDetail,
}: {
  recent: ProgressOverview["recent_activity"];
  onOpenHistory: () => void;
  onOpenWorkoutHistoryDetail: (workoutHistoryId: string) => void;
}) {
  const { colors, typography } = useAppTheme();

  const items = (recent as any)?.last_workouts ?? [];

  return (
    <ProgressSection>
      {/* header row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontFamily: typography.fontFamily.bold,
            fontSize: 18,
          }}
        >
          Recent activity
        </Text>

        {/* IMPORTANT: stop Button being full width */}
        <Button
          title="View History"
          variant="secondary"
          fullWidth={false}
          onPress={onOpenHistory}
        />
      </View>

      {!items.length ? (
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>
          No workouts yet.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 4, gap: 12 }}
        >
          {items.slice(0, 5).map((w: any) => (
            <WorkoutMiniCard
              key={w.workout_history_id}
              w={w}
              onPress={() => onOpenWorkoutHistoryDetail(w.workout_history_id)}
            />
          ))}
        </ScrollView>
      )}
    </ProgressSection>
  );
}
