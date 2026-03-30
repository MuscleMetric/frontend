import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

type UsernameCheckRow = {
  normalized: string;
  is_valid: boolean;
  is_available: boolean;
  reason: string | null;
};

export function EditUsernameModal({
  open,
  onClose,
  initialUsername,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialUsername: string;
  onSaved: (nextUsername: string) => void;
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
          maxWidth: 420,
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

        label: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          letterSpacing: 0.8,
          textTransform: "uppercase",
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

        helper: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        ok: {
          color: colors.primary,
        },

        bad: {
          color: colors.danger,
        },

        footer: {
          flexDirection: "row",
          gap: layout.space.sm,
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.sm,
          paddingBottom: layout.space.lg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },

        secondaryBtn: {
          flex: 1,
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

        primaryBtn: {
          flex: 1,
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          borderRadius: layout.radius.md,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: layout.space.md,
        },

        primaryBtnText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
      }),
    [colors, typography, layout],
  );

  const [username, setUsername] = useState(initialUsername ?? "");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<UsernameCheckRow | null>(null);

  useEffect(() => {
    if (open) {
      setUsername(initialUsername ?? "");
      setCheck(null);
      setChecking(false);
      setSaving(false);
    }
  }, [open, initialUsername]);

  useEffect(() => {
    let alive = true;

    const t = setTimeout(async () => {
      const trimmed = username.trim();

      if (!trimmed) {
        setCheck(null);
        return;
      }

      if ((initialUsername ?? "").trim() === trimmed) {
        setCheck({
          normalized: trimmed.toLowerCase(),
          is_valid: true,
          is_available: true,
          reason: null,
        });
        return;
      }

      setChecking(true);
      const res = await supabase.rpc("check_username_available_v1", {
        p_username: trimmed,
      });

      if (!alive) return;

      setChecking(false);

      if (res.error) {
        console.log("check username error:", res.error);
        setCheck(null);
        return;
      }

      const row = Array.isArray(res.data)
        ? (res.data[0] as UsernameCheckRow | undefined)
        : undefined;

      setCheck(row ?? null);
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [username, initialUsername]);

  const hint = useMemo(() => {
    if (!username.trim()) {
      return {
        text: "3–10 chars, a–z 0–9 _ (no spaces).",
        tone: "muted" as const,
      };
    }

    if (checking) {
      return {
        text: "Checking…",
        tone: "muted" as const,
      };
    }

    if (!check) {
      return {
        text: "3–10 chars, a–z 0–9 _ (no spaces).",
        tone: "muted" as const,
      };
    }

    if (!check.is_valid) {
      return {
        text: `Not allowed (${check.reason ?? "invalid"}).`,
        tone: "bad" as const,
      };
    }

    if (!check.is_available) {
      return {
        text: "Username taken.",
        tone: "bad" as const,
      };
    }

    return {
      text: "Looks good.",
      tone: "ok" as const,
    };
  }, [username, check, checking]);

  const canSave =
    !!username.trim() &&
    ((initialUsername ?? "").trim() === username.trim() ||
      (!!check?.is_valid && !!check?.is_available)) &&
    !saving;

  const save = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) return;

    setSaving(true);

    const res = await supabase.rpc("set_username_v1", { p_username: trimmed });

    setSaving(false);

    if (res.error) {
      console.log("set username error:", res.error);
      Alert.alert("Couldn’t save username", res.error.message ?? "Try again.");
      return;
    }

    onSaved(trimmed);
    onClose();
  }, [username, onClose, onSaved]);

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
              <Text style={styles.title}>Username</Text>
              <Text style={styles.subtitle}>
                Choose a unique handle people can follow.
              </Text>
            </View>

            <View style={styles.body}>
              <Text style={styles.label}>Username</Text>

              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="e.g. harry_fit"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text
                style={[
                  styles.helper,
                  hint.tone === "ok" && styles.ok,
                  hint.tone === "bad" && styles.bad,
                ]}
              >
                {hint.text}
              </Text>
            </View>

            <View style={styles.footer}>
              <Pressable style={styles.secondaryBtn} onPress={onClose}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.primaryBtn, { opacity: canSave ? 1 : 0.5 }]}
                onPress={save}
                disabled={!canSave}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}