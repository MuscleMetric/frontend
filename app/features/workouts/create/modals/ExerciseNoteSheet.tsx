import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { ModalSheet } from "@/ui";
import { useAppTheme } from "../../../../../lib/useAppTheme";

type Props = {
  visible: boolean;
  exerciseName: string;
  initialNote?: string | null;
  onClose: () => void;
  onApply: (note: string) => void;
};

export default function ExerciseNoteSheet({
  visible,
  exerciseName,
  initialNote,
  onClose,
  onApply,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    setNote(String(initialNote ?? ""));
  }, [visible, initialNote]);

  return (
    <ModalSheet visible={visible} onClose={onClose} title={exerciseName}>
      <View style={{ paddingHorizontal: layout.space.md, paddingBottom: layout.space.md, gap: layout.space.md }}>
        <Text style={styles.label}>Notes</Text>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add cues, setup, tempo…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
        />

        <Pressable
          onPress={() => {
            onApply(note.trim());
            onClose();
          }}
          style={styles.applyBtn}
        >
          <Text style={styles.applyText}>Apply note ✓</Text>
        </Pressable>
      </View>
    </ModalSheet>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    label: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: 12,
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    input: {
      minHeight: 120,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: layout.space.md,
      color: colors.text,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
    applyBtn: {
      paddingVertical: 14,
      borderRadius: layout.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    applyText: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
  });
