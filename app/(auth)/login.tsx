// app/(auth)/login.tsx
import { useMemo, useState } from "react";
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
import * as Linking from "expo-linking";
import { useAppTheme } from "../../lib/useAppTheme";

export default function Login() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function ensureProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").upsert({
      id: user.id,
      name: user.user_metadata?.name ?? null,
      email: user.email ?? null,
    });
  }

  async function handleLogin() {
    try {
      if (!email || !password) {
        Alert.alert("Missing info", "Please enter email and password.");
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      await ensureProfile();
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Login failed", err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      Alert.alert(
        "Enter your email",
        "Type your email then tap 'Forgot password?'"
      );
      return;
    }
    const redirectTo = Linking.createURL("/(auth)/reset");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) return Alert.alert("Error", error.message);
    Alert.alert(
      "Check your email",
      "We sent you a link to reset your password."
    );
  }

  const canSubmit = email.length > 0 && password.length > 0 && !loading;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.subtle}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.subtle}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <Pressable
        onPress={handleLogin}
        disabled={!canSubmit}
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonText}>Log in</Text>
        )}
      </Pressable>

      <Pressable onPress={handleForgotPassword} style={styles.linkRow}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(auth)/signup")}
        style={styles.linkRow}
      >
        <Text style={styles.text}>
          Don’t have an account? <Text style={styles.link}>Sign up</Text>
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
      fontSize: 28,
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
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
    linkRow: { alignSelf: "flex-start", marginTop: 12 },
    link: { color: colors.primaryText, fontWeight: "700" },
    text: { color: colors.text },
  });
