// app/features/settings/modals/EditPersonalInfoModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { ModalShell } from "./ModalShell";

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
    date_of_birth: string | null; // YYYY-MM-DD or ISO
  };
  onSaved: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, padding: layout.space.lg, gap: 12 },
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
        row: { flexDirection: "row", gap: 10 },
        col: { flex: 1, gap: 8 },
        helper: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },
        btn: {
          marginTop: 6,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        btnText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
      }),
    [colors, typography, layout]
  );

  const [name, setName] = useState(initial.name ?? "");
  const [height, setHeight] = useState(initial.height_cm?.toString() ?? "");
  const [weight, setWeight] = useState(initial.weight_kg?.toString() ?? "");
  const [dob, setDob] = useState(initial.date_of_birth ? String(initial.date_of_birth).slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial.name ?? "");
    setHeight(initial.height_cm?.toString() ?? "");
    setWeight(initial.weight_kg?.toString() ?? "");
    setDob(initial.date_of_birth ? String(initial.date_of_birth).slice(0, 10) : "");
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
      console.log("set_personal_info_v1 error:", res.error);
      Alert.alert("Couldn’t save", res.error.message ?? "Try again.");
      return;
    }

    onSaved();
    onClose();
  }, [name, height, weight, dob, onSaved, onClose]);

  return (
    <ModalShell visible={open} onClose={onClose} title="Personal Info" subtitle="Keep your profile accurate.">
      <View style={styles.wrap}>
        <Text style={styles.label}>Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your name" placeholderTextColor={colors.textMuted} />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput value={height} onChangeText={setHeight} style={styles.input} keyboardType="number-pad" placeholder="175" placeholderTextColor={colors.textMuted} />
          </View>

          <View style={styles.col}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput value={weight} onChangeText={setWeight} style={styles.input} keyboardType="decimal-pad" placeholder="70" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        <Text style={styles.label}>Date of Birth</Text>
        <TextInput value={dob} onChangeText={setDob} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

        <Text style={styles.helper}>We use this for analytics and goals. You can leave fields blank.</Text>

        <Pressable style={styles.btn} onPress={save}>
          {saving ? <ActivityIndicator /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </View>
    </ModalShell>
  );
}