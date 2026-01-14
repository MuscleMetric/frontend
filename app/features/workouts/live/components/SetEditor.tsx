import React, { useMemo } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { LiveExerciseDraft, LiveSetDraft } from "../../hooks/liveWorkoutTypes";
import { Button, Card, Icon } from "@/ui";

type Field = "reps" | "weight" | "timeSeconds" | "distance";

type Props = {
  exercise: LiveExerciseDraft;

  activeSetNumber: number;
  activeSet: LiveSetDraft | null;
  lastSet: {
    setNumber: number;
    dropIndex: number;
    reps: number | null;
    weight: number | null;
    timeSeconds: number | null;
    distance: number | null;
    notes: string | null;
  } | null;

  onUpdateField: (field: Field, value: number | null) => void;

  onPrevSet: () => void;
  onNextSet: () => void;

  onAddSet: () => void;
  onRemoveSet: () => void;

  onBackToInfo: () => void;
};

function numOrNull(s: string) {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// small helper: estimate 1RM (Epley)
function e1rm(weight: number | null, reps: number | null) {
  if (!weight || !reps || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

export function SetEditor({
  exercise,
  activeSetNumber,
  activeSet,
  lastSet,
  onUpdateField,
  onPrevSet,
  onNextSet,
  onAddSet,
  onRemoveSet,
  onBackToInfo,
}: Props) {
  const { colors, typography, layout } = useAppTheme();

  const setCount = exercise.sets.length;
  const isLastSet = activeSetNumber >= setCount;

  const thisSetE1rm = useMemo(() => {
    return e1rm(activeSet?.weight ?? null, activeSet?.reps ?? null);
  }, [activeSet?.weight, activeSet?.reps]);

  const sessionVolumeSoFar = useMemo(() => {
    // sum only completed/filled sets (reps * weight)
    return exercise.sets.reduce((acc, s) => {
      const r = s.reps ?? null;
      const w = s.weight ?? null;
      if (!r || !w) return acc;
      return acc + r * w;
    }, 0);
  }, [exercise.sets]);

  if (!activeSet) {
    return (
      <Card>
        <Text style={{ fontFamily: typography.fontFamily.medium, color: colors.text }}>
          No active set found.
        </Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: layout.space.md }}>
      {/* Top row: set indicator + back */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={onBackToInfo} style={{ padding: 8, marginLeft: -8 }}>
          <Icon name="arrow-back" size={20} color={colors.textMuted} />
        </Pressable>

        <Text style={{ fontFamily: typography.fontFamily.semibold, color: colors.text }}>
          Set {activeSetNumber} of {setCount}
        </Text>

        <View style={{ width: 28 }} />
      </View>

      {/* Metrics row */}
      <View style={{ flexDirection: "row", gap: layout.space.sm }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontFamily: typography.fontFamily.medium, color: colors.textMuted }}>
            Session volume
          </Text>
          <Text style={{ marginTop: 6, fontFamily: typography.fontFamily.bold, fontSize: typography.size.h2, color: colors.text }}>
            {Math.round(sessionVolumeSoFar).toLocaleString()} kg
          </Text>
        </Card>

        <Card style={{ flex: 1 }}>
          <Text style={{ fontFamily: typography.fontFamily.medium, color: colors.textMuted }}>
            This set e1RM
          </Text>
          <Text style={{ marginTop: 6, fontFamily: typography.fontFamily.bold, fontSize: typography.size.h2, color: colors.text }}>
            {thisSetE1rm ? `${Math.round(thisSetE1rm)} kg` : "—"}
          </Text>
          {exercise.bestE1rm ? (
            <Text style={{ marginTop: 4, fontFamily: typography.fontFamily.medium, color: colors.textMuted }}>
              Best: {Math.round(exercise.bestE1rm)} kg
            </Text>
          ) : null}
        </Card>
      </View>

      {/* Last performance */}
      <Card>
        <Text style={{ fontFamily: typography.fontFamily.semibold, color: colors.text }}>
          Last performance (Set {activeSetNumber})
        </Text>
        <Text style={{ marginTop: 8, fontFamily: typography.fontFamily.regular, color: colors.textMuted }}>
          {lastSet
            ? `${lastSet.weight ?? "—"} kg × ${lastSet.reps ?? "—"} reps`
            : "No history for this set."}
        </Text>
      </Card>

      {/* Inputs */}
      <View style={{ flexDirection: "row", gap: layout.space.sm }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontFamily: typography.fontFamily.medium, color: colors.textMuted }}>
            Weight (kg)
          </Text>
          <TextInput
            value={activeSet.weight == null ? "" : String(activeSet.weight)}
            onChangeText={(t) => onUpdateField("weight", numOrNull(t))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={{
              marginTop: 8,
              fontFamily: typography.fontFamily.bold,
              fontSize: 32,
              color: colors.text,
            }}
          />
        </Card>

        <Card style={{ flex: 1 }}>
          <Text style={{ fontFamily: typography.fontFamily.medium, color: colors.textMuted }}>
            Reps
          </Text>
          <TextInput
            value={activeSet.reps == null ? "" : String(activeSet.reps)}
            onChangeText={(t) => onUpdateField("reps", numOrNull(t))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={{
              marginTop: 8,
              fontFamily: typography.fontFamily.bold,
              fontSize: 32,
              color: colors.text,
            }}
          />
        </Card>
      </View>

      {/* Controls */}
      <View style={{ flexDirection: "row", gap: layout.space.sm, alignItems: "center" }}>
        <Button title="Prev" variant="ghost" onPress={onPrevSet} fullWidth={false} />
        <Pressable
          onPress={onAddSet}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="add" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={onRemoveSet}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="remove" size={20} color={colors.text} />
        </Pressable>
        <Button title={isLastSet ? "Complete" : "Next"} variant="primary" onPress={onNextSet} fullWidth={false} />
      </View>

      {/* Hint */}
      {isLastSet ? (
        <Text style={{ textAlign: "center", fontFamily: typography.fontFamily.medium, color: colors.textMuted }}>
          Last set — “Complete” will move you to the next exercise.
        </Text>
      ) : null}
    </View>
  );
}
