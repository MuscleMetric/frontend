import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

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
        backdrop: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          padding: layout.space.lg,
        },

        keyboardWrap: {
          width: "100%",
          alignItems: "center",
        },

        card: {
          width: "100%",
          maxWidth: 430,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          overflow: "hidden",
        },

        header: {
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
          paddingBottom: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          gap: 4,
        },

        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
        },

        subtitle: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },

        body: {
          padding: layout.space.lg,
          gap: 12,
        },

        warning: {
          color: colors.danger,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        text: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

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

        footer: {
          gap: 10,
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.sm,
          paddingBottom: layout.space.lg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },

        dangerBtn: {
          minHeight: 44,
          borderWidth: 1,
          borderColor: "rgba(239,68,68,0.35)",
          backgroundColor: colors.danger,
          borderRadius: layout.radius.md,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: layout.space.md,
        },

        dangerBtnText: {
          color: "#fff",
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },

        secondaryBtn: {
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: layout.space.md,
        },

        secondaryBtnText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
      }),
    [colors, typography, layout],
  );

  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirm("");
    setLoading(false);
  }, [open]);

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
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>Delete Account</Text>
              <Text style={styles.subtitle}>This cannot be undone.</Text>
            </View>

            <View style={styles.body}>
              <Text style={styles.warning}>Warning</Text>

              <Text style={styles.text}>
                Deleting your account removes your data and disconnects your
                profile from the app. To confirm, type DELETE.
              </Text>

              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                style={styles.input}
                placeholder="Type DELETE"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.footer}>
              <Pressable
                style={[styles.dangerBtn, { opacity: canDelete && !loading ? 1 : 0.5 }]}
                onPress={requestDelete}
                disabled={!canDelete || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.dangerBtnText}>Request Deletion</Text>
                )}
              </Pressable>

              <Pressable style={styles.secondaryBtn} onPress={onClose}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}