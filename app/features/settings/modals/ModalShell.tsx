// app/features/settings/modals/ModalShell.tsx
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function ModalShell({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          padding: layout.space.lg,
        },
        card: {
          width: "80%",
          height: "80%",
          borderRadius: layout.radius.xl ?? layout.radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        safe: { flex: 1 },
        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.md,
          paddingBottom: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },
        headerLeft: { flex: 1, gap: 2 },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.h3 ?? typography.size.h2,
          lineHeight: typography.lineHeight.h3 ?? typography.lineHeight.h2,
        },
        subtitle: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },
        closeBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        },
        body: { flex: 1 },
      }),
    [colors, typography, layout]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                {!!subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>

              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                <X size={18} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.body}>{children}</View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}