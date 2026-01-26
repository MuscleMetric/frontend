import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export default function ExerciseRow({
  name,
  notePreview,
  isFavourite,
  onToggleFavourite,
  onOpenNote,
  onRemove,
  dragHandle,
}: {
  name: string;
  notePreview?: string | null;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onOpenNote: () => void;
  onRemove: () => void;
  dragHandle?: React.ReactNode; // optional for drag-and-drop libs
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = makeStyles(colors, typography, layout);

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>

        <Pressable onPress={onOpenNote} hitSlop={10}>
          <Text style={styles.note} numberOfLines={1}>
            {notePreview?.trim()?.length ? notePreview : "Add note"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onToggleFavourite} hitSlop={10} style={styles.iconBtn}>
          <Text style={[styles.icon, isFavourite ? styles.iconOn : null]}>
            ★
          </Text>
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
