// app/features/workouts/create/ui/ExerciseRow.tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

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
  const styles = makeStyles(colors, typography, layout);

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>

        {/* small controls row */}
        <View style={styles.metaRow}>
          <Pressable onPress={onToggleDropset} hitSlop={10} style={styles.pillBtn}>
            <Text style={[styles.pillText, isDropset ? styles.pillOn : styles.pillOff]}>
              Dropset
            </Text>
          </Pressable>

          <Pressable onPress={onOpenSuperset} hitSlop={10} style={styles.pillBtn}>
            <Text style={[styles.pillText, supersetGroup ? styles.pillOn : styles.pillOff]}>
              {supersetGroup ? `Superset ${supersetGroup}` : "Superset"}
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
        <Pressable onPress={onToggleFavourite} hitSlop={10} style={styles.iconBtn}>
          <Text style={[styles.icon, isFavourite ? styles.iconOn : null]}>★</Text>
        </Pressable>

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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pillText: {
      fontFamily: typography.fontFamily.bold,
      fontSize: 12,
      letterSpacing: 0.2,
    },
    pillOn: {
      color: colors.primary,
    },
    pillOff: {
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
    },
    iconBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: layout.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    icon: {
      fontFamily: typography.fontFamily.bold,
      fontSize: 14,
      color: colors.textMuted,
    },
    iconOn: {
      color: colors.text,
    },
  });
