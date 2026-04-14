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

import { log } from "@/lib/logger";

export function EditPersonalInfoModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: {
    name: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    date_of_birth: string | null;
  };
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
          maxWidth: 560,
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

        row: {
          flexDirection: "row",
          gap: 10,
        },

        col: {
          flex: 1,
          gap: 8,
        },

        helper: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          marginTop: 4,
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

  const [name, setName] = useState(initial.name ?? "");
  const [height, setHeight] = useState(initial.height_cm?.toString() ?? "");
  const [weight, setWeight] = useState(initial.weight_kg?.toString() ?? "");
  const [dob, setDob] = useState(
    initial.date_of_birth ? String(initial.date_of_birth).slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial.name ?? "");
    setHeight(initial.height_cm?.toString() ?? "");
    setWeight(initial.weight_kg?.toString() ?? "");
    setDob(
      initial.date_of_birth ? String(initial.date_of_birth).slice(0, 10) : "",
    );
    setSaving(false);
  }, [open, initial]);

  const save = useCallback(async () => {
    const h = height.trim() ? Number(height.trim()) : null;
    const w = weight.trim() ? Number(weight.trim()) : null;
    const d = dob.trim() ? dob.trim() : null;

    if (height.trim() && (!Number.isFinite(h) || h! <= 0)) {
      Alert.alert("Invalid height", "Enter a valid height in cm.");
      return;
    }

    if (weight.trim() && (!Number.isFinite(w) || w! <= 0)) {
      Alert.alert("Invalid weight", "Enter a valid weight in kg.");
      return;
    }

    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD.");
      return;
    }

    setSaving(true);

    const res = await supabase.rpc("set_personal_info_v1", {
      p_name: name.trim() || null,
      p_height_cm: h,
      p_weight_kg: w,
      p_date_of_birth: d,
    });

    setSaving(false);

    if (res.error) {
      log("set_personal_info_v1 error:", res.error);
      Alert.alert("Couldn’t save", res.error.message ?? "Try again.");
      return;
    }

    onSaved();
    onClose();
  }, [name, height, weight, dob, onSaved, onClose]);

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
              <Text style={styles.title}>Personal Info</Text>
              <Text style={styles.subtitle}>Keep your profile accurate.</Text>
            </View>

            <View style={styles.body}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Height (cm)</Text>
                  <TextInput
                    value={height}
                    onChangeText={setHeight}
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="175"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.col}>
                  <Text style={styles.label}>Weight (kg)</Text>
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="70"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                value={dob}
                onChangeText={setDob}
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.helper}>
                We use this for analytics and goals. You can leave fields blank.
              </Text>
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
