// app/features/settings/modals/ConfirmDeleteAccountModal.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { ModalShell } from "./ModalShell";

export function ConfirmDeleteAccountModal({
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
        wrap: { flex: 1, padding: layout.space.lg, gap: 12 },
        warning: { color: colors.danger, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
        text: { color: colors.textMuted, fontFamily: typography.fontFamily.regular, fontSize: typography.size.meta, lineHeight: typography.lineHeight.meta },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
        },
        btn: {
          marginTop: 6,
          borderWidth: 1,
          borderColor: "rgba(239,68,68,0.35)",
          backgroundColor: colors.danger,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        btnText: { color: "#fff", fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
        ghost: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        ghostText: { color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
      }),
    [colors, typography, layout]
  );

  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const canDelete = confirm.trim().toUpperCase() === "DELETE";

  const requestDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    const res = await supabase.rpc("request_account_deletion_v1");
    setLoading(false);

    if (res.error) {
      console.log("request_account_deletion_v1 error:", res.error);
      return;
    }

    onClose();
  };

  return (
    <ModalShell visible={open} onClose={onClose} title="Delete Account" subtitle="This cannot be undone.">
      <View style={styles.wrap}>
        <Text style={styles.warning}>Warning</Text>
        <Text style={styles.text}>
          Deleting your account removes your data and disconnects your profile from the app. To confirm, type DELETE.
        </Text>

        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          style={styles.input}
          placeholder="Type DELETE"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
        />

        <Pressable style={[styles.btn, { opacity: canDelete ? 1 : 0.5 }]} onPress={requestDelete} disabled={!canDelete}>
          {loading ? <ActivityIndicator /> : <Text style={styles.btnText}>Request Deletion</Text>}
        </Pressable>

        <Pressable style={styles.ghost} onPress={onClose}>
          <Text style={styles.ghostText}>Cancel</Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}