// app/features/settings/modals/ConfirmLogoutModal.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { ModalShell } from "./ModalShell";

export function ConfirmLogoutModal({
  open,
  onClose,
  onLoggedOut,
}: {
  open: boolean;
  onClose: () => void;
  onLoggedOut: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, padding: layout.space.lg, justifyContent: "space-between" },
        text: { color: colors.text, fontFamily: typography.fontFamily.regular, fontSize: typography.size.body, lineHeight: typography.lineHeight.body },
        actions: { gap: 10 },
        btn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primary, borderRadius: layout.radius.md, paddingVertical: 12, alignItems: "center" },
        btnText: { color: colors.onPrimary, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
        ghost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: layout.radius.md, paddingVertical: 12, alignItems: "center" },
        ghostText: { color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
      }),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    const res = await supabase.auth.signOut();
    setLoading(false);

    if (res.error) {
      console.log("signOut error:", res.error);
      return;
    }

    onClose();
    onLoggedOut();
  };

  return (
    <ModalShell visible={open} onClose={onClose} title="Log Out" subtitle="You can log back in any time.">
      <View style={styles.wrap}>
        <Text style={styles.text}>Are you sure you want to log out of your account?</Text>

        <View style={styles.actions}>
          <Pressable style={styles.btn} onPress={logout}>
            {loading ? <ActivityIndicator /> : <Text style={styles.btnText}>Log Out</Text>}
          </Pressable>

          <Pressable style={styles.ghost} onPress={onClose}>
            <Text style={styles.ghostText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </ModalShell>
  );
}