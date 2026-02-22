// app/features/settings/modals/HelpSupportModal.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ModalShell } from "./ModalShell";

export function HelpSupportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, padding: layout.space.lg, gap: 10 },
        row: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
        },
        title: { color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
        sub: { marginTop: 4, color: colors.textMuted, fontFamily: typography.fontFamily.regular, fontSize: typography.size.meta },
      }),
    [colors, typography, layout]
  );

  const openMail = () => Linking.openURL("mailto:support@musclemetric.app?subject=Support");
  const openFaq = () => Linking.openURL("https://musclemetric.app/help");

  return (
    <ModalShell visible={open} onClose={onClose} title="Help & Support" subtitle="We’ll get you sorted quickly.">
      <View style={styles.wrap}>
        <Pressable style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} onPress={openMail}>
          <Text style={styles.title}>Contact Support</Text>
          <Text style={styles.sub}>Email us for help with your account or bugs.</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} onPress={openFaq}>
          <Text style={styles.title}>Help Centre</Text>
          <Text style={styles.sub}>FAQs and guides.</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}