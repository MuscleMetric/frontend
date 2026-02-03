// app/features/workouts/create/modals/SupersetSheet.tsx
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { ModalSheet } from "@/ui";
import { useAppTheme } from "../../../../../lib/useAppTheme";

type Props = {
  visible: boolean;
  exerciseName: string;
  currentGroup: string | null;

  existingGroups: string[]; // ["A","B",...]
  suggestedNewGroup: string; // "A" if none exist, else next free letter

  onClose: () => void;
  onPickGroup: (group: string | null) => void;
};

export default function SupersetSheet({
  visible,
  exerciseName,
  currentGroup,
  existingGroups,
  suggestedNewGroup,
  onClose,
  onPickGroup,
}: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const groups = useMemo(() => {
    const uniq = Array.from(new Set((existingGroups ?? []).map((g) => String(g).toUpperCase())));
    uniq.sort();
    return uniq;
  }, [existingGroups]);

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Superset">
      <View style={{ paddingHorizontal: layout.space.md, paddingBottom: layout.space.md, gap: layout.space.md }}>
        <Text style={styles.muted}>
          Add <Text style={styles.strong}>{exerciseName}</Text> to a superset.
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: layout.space.sm }}>
          {groups.map((g) => {
            const active = currentGroup === g;
            return (
              <Pressable
                key={g}
                onPress={() => onPickGroup(g)}
                style={[styles.pillBtn, active ? styles.pillActive : styles.pillIdle]}
              >
                <Text style={active ? styles.pillTextActive : styles.pillTextIdle}>
                  Superset {g}
                </Text>
              </Pressable>
            );
          })}

          {/* Always offer "Create new" */}
          <Pressable
            onPress={() => onPickGroup(suggestedNewGroup)}
            style={[styles.pillBtn, styles.pillIdle]}
          >
            <Text style={styles.pillTextIdle}>Create Superset {suggestedNewGroup}</Text>
          </Pressable>
        </View>

        <Pressable onPress={onClose} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
      </View>
    </ModalSheet>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    muted: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
    strong: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
    },

    pillBtn: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },
    pillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillIdle: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    pillTextActive: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: 13,
    },
    pillTextIdle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: 13,
    },

    secondaryBtn: {
      marginTop: layout.space.sm,
      paddingVertical: 14,
      borderRadius: layout.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    secondaryText: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
  });
