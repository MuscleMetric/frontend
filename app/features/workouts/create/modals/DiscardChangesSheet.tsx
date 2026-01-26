import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { ModalSheet } from "@/ui";
import { useAppTheme } from "../../../../../lib/useAppTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onDiscard: () => void;
};

export default function DiscardChangesSheet({ visible, onClose, onDiscard }: Props) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Discard changes?">
      <View style={{ paddingHorizontal: layout.space.md, paddingBottom: layout.space.md, gap: layout.space.md }}>
        <Text style={styles.muted}>
          You have unsaved changes. If you leave now, this workout won’t be saved.
        </Text>

        <Pressable onPress={onDiscard} style={styles.destructive}>
          <Text style={styles.destructiveText}>Discard</Text>
        </Pressable>

        <Pressable onPress={onClose} style={styles.secondary}>
          <Text style={styles.secondaryText}>Keep editing</Text>
        </Pressable>
      </View>
    </ModalSheet>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    muted: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.textMuted,
    },
    destructive: {
      paddingVertical: 14,
      borderRadius: layout.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.danger ?? "#E5484D",
    },
    destructiveText: {
      color: "#fff",
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },
    secondary: {
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
