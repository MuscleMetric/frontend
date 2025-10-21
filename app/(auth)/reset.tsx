// app/(auth)/reset.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAppTheme } from "../../lib/useAppTheme";

export default function ResetPassword() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSetPassword() {
    if (!password || password.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      Alert.alert("Success", "Your password has been updated.");
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Couldn't reset password", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = password.length >= 6 && confirm.length >= 6 && !loading;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set a new password</Text>

      <TextInput
        placeholder="New password"
        placeholderTextColor={colors.subtle}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TextInput
        placeholder="Confirm password"
        placeholderTextColor={colors.subtle}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        style={styles.input}
      />

      <Pressable
        onPress={handleSetPassword}
        disabled={!canSubmit}
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonText}>Save password</Text>
        )}
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
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
  });
