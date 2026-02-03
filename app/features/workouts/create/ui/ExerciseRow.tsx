// app/features/workouts/create/ui/ExerciseRow.tsx
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

function groupColor(group: string | null, colors: any) {
  // Keep it deterministic. We’ll just map to existing theme colors so it
  // always works in light/dark without adding new tokens.
  // If you *do* have more tokens later (purple/teal/etc), swap them in here.
  if (!group) return null;
  const g = String(group).toUpperCase();

  switch (g) {
    case "A":
      return colors.primary;
    case "B":
      return colors.success ?? colors.primary;
    case "C":
      return colors.warn ?? colors.primary;
    case "D":
      return colors.danger ?? colors.primary;
    case "E":
      return colors.accent ?? colors.primary;
    case "F":
      return colors.info ?? colors.primary;
    default:
      return colors.primary;
  }
}

export default function ExerciseRow({
  name,
  notePreview,
  isFavourite,
  isDropset,
  supersetGroup,

  onToggleFavourite,
  onToggleDropset,
  onOpenSuperset,
  onOpenNote,
  onRemove,

  dragHandle,
}: {
  name: string;
  notePreview?: string | null;

  isFavourite: boolean;
  isDropset: boolean;
  supersetGroup: string | null;

  onToggleFavourite: () => void;
  onToggleDropset: () => void;
  onOpenSuperset: () => void;

  onOpenNote: () => void;
  onRemove: () => void;

  dragHandle?: React.ReactNode;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const supersetAccent = groupColor(supersetGroup, colors);

  return (
    <View
      style={[
        styles.row,
        supersetGroup ? styles.rowSuperset : null,
        supersetAccent ? { borderLeftColor: supersetAccent } : null,
      ]}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>

        {/* small controls row */}
        <View style={styles.metaRow}>
          <Pressable
            onPress={onToggleDropset}
            hitSlop={8}
            style={[
              styles.pillBtn,
              isDropset ? styles.pillBtnActive : null,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                isDropset ? styles.pillTextActive : styles.pillTextIdle,
              ]}
            >
              Dropset
            </Text>
          </Pressable>

          <Pressable
            onPress={onOpenSuperset}
            hitSlop={8}
            style={[
              styles.pillBtn,
              supersetGroup ? styles.pillBtnActive : null,
              supersetAccent ? { borderColor: supersetAccent } : null,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                supersetGroup ? styles.pillTextActive : styles.pillTextIdle,
                supersetAccent && supersetGroup ? { color: supersetAccent } : null,
              ]}
            >
              {supersetGroup ? `Superset ${String(supersetGroup).toUpperCase()}` : "Superset"}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={onOpenNote} hitSlop={10}>
          <Text style={styles.note} numberOfLines={1}>
            {notePreview?.trim()?.length ? notePreview : "Add note"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.actions}>

        <Pressable onPress={onRemove} hitSlop={10} style={styles.iconBtn}>
          <Text style={styles.icon}>✕</Text>
        </Pressable>

        {dragHandle ? <View style={{ marginLeft: 6 }}>{dragHandle}</View> : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: "transparent",

      // default (no superset)
      borderLeftWidth: 0,
      borderLeftColor: "transparent",
      borderRadius: layout.radius.lg,
    },

    // when in a superset we give it a left stripe
    rowSuperset: {
      borderLeftWidth: 4,
      // subtle lift so it reads as a “grouped” block
      backgroundColor: colors.surface,
    },

    name: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },

    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    pillBtn: {
      minHeight: 32,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      justifyContent: "center",
    },
    pillBtnActive: {
      // keep background same; the “active” read comes from text + border
      backgroundColor: colors.surface,
    },
    pillText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: 12,
      letterSpacing: 0.2,
    },
    pillTextActive: {
      color: colors.primary,
    },
    pillTextIdle: {
      color: colors.textMuted,
    },

    note: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginLeft: layout.space.sm,
    },

    iconBtn: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    icon: {
      fontFamily: typography.fontFamily.bold,
      fontSize: 15,
      color: colors.textMuted,
    },
    iconOn: {
      color: colors.text,
    },
  });
