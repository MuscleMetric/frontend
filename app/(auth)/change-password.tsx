// app/(auth)/change-password.tsx
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAppTheme } from "../../lib/useAppTheme";

export default function ChangePassword() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChange() {
    if (!password || password.length < 6)
      return Alert.alert("Use at least 6 characters");
    if (password !== confirm) return Alert.alert("Passwords don't match");

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert("Updated", "Your password has been changed.");
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Change Password</Text>

      <TextInput
        secureTextEntry
        placeholder="New password"
        placeholderTextColor={colors.subtle}
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TextInput
        secureTextEntry
        placeholder="Confirm password"
        placeholderTextColor={colors.subtle}
        value={confirm}
        onChangeText={setConfirm}
        style={styles.input}
      />

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleChange}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Saving..." : "Save"}
        </Text>
      </Pressable>
    </View>
  );
}

/* ---- themed styles ---- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      padding: 24,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 16,
      color: colors.text,
      textAlign: "center",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.text,
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
      fontSize: 16,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
  });
