import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card } from "@/ui";
import ExerciseRow from "./ExerciseRow";

export type CreateExerciseItem = {
  exerciseId: string;
  name: string;
  note: string | null;
  isFavourite: boolean;
};

export default function ExerciseList({
  items,
  onAdd,
  onRemove,
  onToggleFavourite,
  onOpenNote,
  renderDragHandle,
}: {
  items: CreateExerciseItem[];
  onAdd: () => void;
  onRemove: (exerciseId: string) => void;
  onToggleFavourite: (exerciseId: string) => void;
  onOpenNote: (exerciseId: string) => void;
  renderDragHandle?: (exerciseId: string) => React.ReactNode;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = makeStyles(colors, typography, layout);

  return (
    <Card>
      <View style={{ gap: layout.space.sm }}>
        <View style={styles.header}>
          <Text style={styles.label}>Exercises</Text>
          <Pressable onPress={onAdd} hitSlop={10} style={styles.addBtn}>
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={styles.muted}>Add exercises to this workout.</Text>
        ) : (
          <View>
            {items.map((it) => (
              <ExerciseRow
                key={it.exerciseId}
                name={it.name}
                notePreview={it.note}
                isFavourite={it.isFavourite}
                onToggleFavourite={() => onToggleFavourite(it.exerciseId)}
                onOpenNote={() => onOpenNote(it.exerciseId)}
                onRemove={() => onRemove(it.exerciseId)}
                dragHandle={
                  renderDragHandle ? renderDragHandle(it.exerciseId) : undefined
                }
              />
            ))}
          </View>
        )}

        <Text style={styles.hint}>
          Tip: favourite ★ exercises you want to keep near the top.
        </Text>
      </View>
    </Card>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    label: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    addBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    addText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.text,
    },
    muted: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },
    hint: {
      fontFamily: typography.fontFamily.medium,
      fontSize: 12,
      color: colors.textMuted,
    },
  });
