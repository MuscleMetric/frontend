import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

import { log } from "@/lib/logger";

type Level = "beginner" | "intermediate" | "advanced";

export function ExperienceModal({
  open,
  onClose,
  initialLevel,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialLevel: Level | null;
  onSaved: () => void;
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
          maxWidth: 460,
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
          gap: 10,
        },

        option: {
          paddingVertical: 14,
          paddingHorizontal: layout.space.lg,
          borderRadius: layout.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          gap: 4,
        },

        optionActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },

        optionText: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          color: colors.text,
        },

        optionTextActive: {
          color: colors.onPrimary,
        },

        helper: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        helperActive: {
          color: "rgba(255,255,255,0.88)",
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

  const [level, setLevel] = useState<Level>(initialLevel ?? "beginner");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLevel(initialLevel ?? "beginner");
    setSaving(false);
  }, [open, initialLevel]);

  const save = useCallback(async () => {
    setSaving(true);

    const res = await supabase.rpc("set_profile_settings_v1", {
      p_key: "level",
      p_value: level,
    });

    setSaving(false);

    if (res.error) {
      log("set_profile_settings_v1(level) error:", res.error);
      return;
    }

    onSaved();
    onClose();
  }, [level, onSaved, onClose]);

  const opts: Array<{ key: Level; title: string; desc: string }> = [
    {
      key: "beginner",
      title: "Beginner",
      desc: "New to training or returning after time off.",
    },
    {
      key: "intermediate",
      title: "Intermediate",
      desc: "Consistent training, building strength and volume.",
    },
    {
      key: "advanced",
      title: "Advanced",
      desc: "Highly consistent, strong technique and progression.",
    },
  ];

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
              <Text style={styles.title}>Experience Level</Text>
              <Text style={styles.subtitle}>
                Used to tailor plans and recommendations.
              </Text>
            </View>

            <View style={styles.body}>
              {opts.map((o) => {
                const active = o.key === level;

                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setLevel(o.key)}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <Text
                      style={[styles.optionText, active && styles.optionTextActive]}
                    >
                      {o.title}
                    </Text>

                    <Text style={[styles.helper, active && styles.helperActive]}>
                      {o.desc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footer}>
              <Pressable style={styles.secondaryBtn} onPress={onClose}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.primaryBtn, { opacity: saving ? 0.7 : 1 }]}
                onPress={save}
                disabled={saving}
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