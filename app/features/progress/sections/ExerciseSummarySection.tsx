import React, { useMemo, useState } from "react";
import { Text, View, TextInput } from "react-native";
import { ListRow, Button, ModalSheet } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";

function fmtDateShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export default function ExerciseSummarySection({
  exerciseSummary,
  onOpenExercise,
}: {
  exerciseSummary: ProgressOverview["exercise_summary"];
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { colors, typography } = useAppTheme();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const minSessions = exerciseSummary.min_sessions ?? 3;

  // ✅ new type fields
  const eligible = exerciseSummary.eligible_exercises ?? [];
  const topPicks = exerciseSummary.best_picks ?? [];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return eligible;
    return eligible.filter((x) => x.exercise_name.toLowerCase().includes(s));
  }, [eligible, q]);

  const emptyState =
    exerciseSummary.prompt?.subtitle ??
    `Train an exercise at least ${minSessions} times to unlock deep analytics.`;

  return (
    <ProgressSection>
      {/* Header row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
              fontSize: 18,
            }}
          >
            Deep analytics
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: 13 }}>
            Choose an exercise to explore trends
          </Text>
        </View>

        {eligible.length > 0 ? (
          <Button
            title="See all"
            variant="secondary"
            onPress={() => setOpen(true)}
          />
        ) : null}
      </View>

      {/* Context */}
      <Text style={{ color: colors.textMuted, marginTop: 8 }}>
        {eligible.length > 0
          ? "Best picks based on your recent training history."
          : emptyState}
      </Text>

      {/* Top picks (5) */}
      {topPicks.length ? (
        <View style={{ marginTop: 2 }}>
          {topPicks.map((x) => (
            <View style={{ marginTop: 10 }}>
              <ListRow
                key={x.exercise_id}
                title={x.exercise_name}
                subtitle={`${
                  x.sessions_30d
                } sessions (30d) · last ${fmtDateShort(x.last_done_at)}`}
                onPress={() => onOpenExercise(x.exercise_id)}
              />
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, marginTop: 10 }}>
          {emptyState}
        </Text>
      )}

      {/* Picker modal */}
      <ModalSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Choose an exercise"
      >
        <View style={{ padding: 12 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search exercises"
            placeholderTextColor={colors.textMuted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          />

          <View style={{ marginTop: 12 }}>
            {filtered.map((x) => (
              <ListRow
                key={x.exercise_id}
                title={x.exercise_name}
                subtitle={`${
                  x.sessions_30d
                } sessions (30d) · last ${fmtDateShort(x.last_done_at)}`}
                onPress={() => {
                  setOpen(false);
                  onOpenExercise(x.exercise_id);
                }}
              />
            ))}

            {!filtered.length ? (
              <Text style={{ color: colors.textMuted, marginTop: 10 }}>
                No matches.
              </Text>
            ) : null}
          </View>
        </View>
      </ModalSheet>
    </ProgressSection>
  );
}
