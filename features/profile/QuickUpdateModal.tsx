// app/features/profile/QuickUpdateModal.tsx
import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../../../lib/supabase";
import { useAppTheme } from "../../../lib/useAppTheme";

export default function QuickUpdateModal({
  visible,
  onClose,
  userId,
  field,
  currentValue,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string;
  field: "height" | "weight";
  currentValue: number | null;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [value, setValue] = useState(currentValue ? String(currentValue) : "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      setLoading(true);
      const num = Number(trimmed);
      if (!isFinite(num)) throw new Error("Please enter a valid number.");
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: num })
        .eq("id", userId);
      if (error) throw error;
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalContainer}
        >
          <View style={styles.modal}>
            <Text style={styles.title}>
              Update {field === "height" ? "Height (cm)" : "Weight (kg)"}
            </Text>

            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="numeric"
              placeholder={field === "height" ? "e.g. 175" : "e.g. 70"}
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            {loading ? (
              <ActivityIndicator />
            ) : (
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            )}

            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    modalContainer: { width: "100%" },
    modal: {
      backgroundColor: colors.card,
      padding: 24,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: "800", marginBottom: 12, color: colors.text },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      marginBottom: 16,
      backgroundColor: colors.card,
      color: colors.text,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    saveText: { color: colors.onPrimary ?? "#fff", fontWeight: "700", fontSize: 16 },
    cancelBtn: { alignItems: "center", marginTop: 12 },
    cancelText: { color: colors.subtle, fontWeight: "600" },
  });
