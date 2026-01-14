import React, { useMemo, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { LiveWorkoutDraft } from "../../hooks/liveWorkoutTypes";
import { Button, Card, Icon } from "@/ui";
import { SetEditor } from "./SetEditor";

type Props = {
  visible: boolean;
  onClose: () => void;

  draft: LiveWorkoutDraft;
  setDraft: (next: LiveWorkoutDraft) => Promise<void>;

  onUpdateSetValue: (args: {
    exerciseIndex: number;
    setNumber: number;
    field: "reps" | "weight" | "timeSeconds" | "distance";
    value: number | null;
  }) => void;

  onAddSet: (exerciseIndex: number) => void;
  onRemoveSet: (exerciseIndex: number) => void;
  onPrevSet: () => void;
  onNextSet: () => void;

  onSwapExercise: () => void;
};

export function ExerciseEntrySheet({
  visible,
  onClose,
  draft,
  setDraft,
  onUpdateSetValue,
  onAddSet,
  onRemoveSet,
  onPrevSet,
  onNextSet,
  onSwapExercise,
}: Props) {
  const { colors, typography, layout } = useAppTheme();

  const idx = draft.ui.activeExerciseIndex;
  const ex = draft.exercises[idx];

  const [mode, setMode] = useState<"info" | "set">("info");

  const activeSetNumber = draft.ui.activeSetNumber;

  const activeSet = useMemo(() => {
    return ex?.sets.find((s) => s.setNumber === activeSetNumber) ?? ex?.sets[0] ?? null;
  }, [ex, activeSetNumber]);

  const lastSet = useMemo(() => {
    const ls = ex?.lastSession?.sets ?? [];
    return ls.find((s) => s.setNumber === activeSetNumber) ?? null;
  }, [ex, activeSetNumber]);

  if (!ex) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {/* Backdrop */}
      <Pressable
        onPress={() => {
          setMode("info");
          onClose();
        }}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: layout.radius.xl,
            borderTopRightRadius: layout.radius.xl,
            padding: layout.space.lg,
            maxHeight: "92%",
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: typography.fontFamily.bold,
                  fontSize: typography.size.h2,
                  color: colors.text,
                }}
                numberOfLines={2}
              >
                {ex.name}
              </Text>

              <Text
                style={{
                  marginTop: 4,
                  fontFamily: typography.fontFamily.medium,
                  fontSize: typography.size.sub,
                  color: colors.textMuted,
                }}
                numberOfLines={1}
              >
                {ex.equipment ? `${ex.equipment} • ` : ""}{ex.type ?? "Exercise"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: layout.space.sm, marginLeft: layout.space.sm }}>
              <Pressable onPress={onSwapExercise} style={{ padding: 8 }}>
                <Icon name="ellipsis-horizontal" size={20} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode("info");
                  onClose();
                }}
                style={{ padding: 8 }}
              >
                <Icon name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={{ height: layout.space.md }} />

          {mode === "info" ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: layout.space.md, paddingBottom: layout.space.lg }}
            >
              {/* Prescription */}
              <Card>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: typography.fontFamily.semibold, color: colors.text }}>
                    Today’s target
                  </Text>
                  <Text style={{ fontFamily: typography.fontFamily.regular, color: colors.textMuted }}>
                    {ex.prescription?.targetSets ? `${ex.prescription.targetSets} sets` : `${ex.sets.length} sets`}
                    {ex.prescription?.targetReps ? ` • ${ex.prescription.targetReps} reps` : ""}
                    {ex.prescription?.targetWeight ? ` • ${ex.prescription.targetWeight} kg` : ""}
                  </Text>
                </View>
              </Card>

              {/* Instructions */}
              {ex.instructions ? (
                <Card>
                  <Text style={{ fontFamily: typography.fontFamily.semibold, color: colors.text }}>
                    Form cues
                  </Text>
                  <Text
                    style={{
                      marginTop: 8,
                      fontFamily: typography.fontFamily.regular,
                      color: colors.textMuted,
                      lineHeight: typography.lineHeight.sub,
                    }}
                  >
                    {ex.instructions}
                  </Text>
                </Card>
              ) : null}

              {/* Last session snapshot */}
              <Card>
                <Text style={{ fontFamily: typography.fontFamily.semibold, color: colors.text }}>
                  Last time
                </Text>
                <Text style={{ marginTop: 8, fontFamily: typography.fontFamily.regular, color: colors.textMuted }}>
                  {ex.lastSession?.completedAt ? `Completed: ${new Date(ex.lastSession.completedAt).toDateString()}` : "No history yet"}
                </Text>
              </Card>

              <Button
                title={`Start Set ${draft.ui.activeSetNumber}`}
                variant="primary"
                onPress={() => setMode("set")}
              />
            </ScrollView>
          ) : (
            <View style={{ gap: layout.space.md }}>
              <SetEditor
                exercise={ex}
                activeSetNumber={draft.ui.activeSetNumber}
                activeSet={activeSet}
                lastSet={lastSet}
                onUpdateField={(field, value) =>
                  onUpdateSetValue({
                    exerciseIndex: idx,
                    setNumber: draft.ui.activeSetNumber,
                    field,
                    value,
                  })
                }
                onPrevSet={onPrevSet}
                onNextSet={onNextSet}
                onAddSet={() => onAddSet(idx)}
                onRemoveSet={() => onRemoveSet(idx)}
                onBackToInfo={() => setMode("info")}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
