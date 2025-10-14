import React, { useState } from "react";
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
  const [value, setValue] = useState(
    currentValue ? String(currentValue) : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: Number(value) })
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
    <Modal visible={visible} transparent animationType="slide">
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: { width: "100%" },
  modal: {
    backgroundColor: "white",
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: "#0b6aa9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: { color: "white", fontWeight: "700", fontSize: 16 },
  cancelBtn: { alignItems: "center", marginTop: 12 },
  cancelText: { color: "#6b7280", fontWeight: "600" },
});
