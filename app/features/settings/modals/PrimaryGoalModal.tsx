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

type Goal =
  | "get_stronger"
  | "build_muscle"
  | "lose_fat"
  | "improve_endurance"
  | "general_fitness";

export function PrimaryGoalModal({
  open,
  onClose,
  initialGoal,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialGoal: string | null;
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
          maxWidth: 480,
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

        headerTitle: {
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

        optionTitle: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          color: colors.text,
        },

        optionTitleActive: {
          color: colors.onPrimary,
        },

        optionDesc: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        optionDescActive: {
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

  const [goal, setGoal] = useState<Goal>("get_stronger");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGoal((initialGoal as Goal) ?? "get_stronger");
    setSaving(false);
  }, [open, initialGoal]);

  const save = useCallback(async () => {
    setSaving(true);

    const res = await supabase.rpc("set_profile_settings_v1", {
      p_key: "primaryGoal",
      p_value: goal,
    });

    setSaving(false);

    if (res.error) {
      console.log("set_profile_settings_v1(primaryGoal) error:", res.error);
      return;
    }

    onSaved();
    onClose();
  }, [goal, onSaved, onClose]);

  const opts: Array<{ key: Goal; title: string; desc: string }> = [
    {
      key: "get_stronger",
      title: "Get Stronger",
      desc: "Prioritize strength and progressive overload.",
    },
    {
      key: "build_muscle",
      title: "Build Muscle",
      desc: "Hypertrophy focused training and volume.",
    },
    {
      key: "lose_fat",
      title: "Lose Fat",
      desc: "Support fat loss with training consistency.",
    },
    {
      key: "improve_endurance",
      title: "Improve Endurance",
      desc: "Performance and conditioning focus.",
    },
    {
      key: "general_fitness",
      title: "General Fitness",
      desc: "Balanced approach for overall health.",
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
              <Text style={styles.headerTitle}>Primary Goal</Text>
              <Text style={styles.subtitle}>
                Used across plans, insights, and coaching.
              </Text>
            </View>

            <View style={styles.body}>
              {opts.map((o) => {
                const active = o.key === goal;

                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setGoal(o.key)}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <Text
                      style={[
                        styles.optionTitle,
                        active && styles.optionTitleActive,
                      ]}
                    >
                      {o.title}
                    </Text>

                    <Text
                      style={[
                        styles.optionDesc,
                        active && styles.optionDescActive,
                      ]}
                    >
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