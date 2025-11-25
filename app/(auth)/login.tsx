// app/(auth)/login.tsx
import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAppTheme } from "../../lib/useAppTheme";

export default function Login() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);

  async function signInWithProvider(provider: "google" | "apple") {
    try {
      setLoadingProvider(provider);

      // This works in Expo Go, dev builds, and production:
      // exp://.../--/auth/callback in Expo Go
      // musclemetric://auth/callback in a dev/prod build
      const redirectTo = Linking.createURL("/callback");

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) throw error;

      // After this, the browser opens → user signs in →
      // Supabase stores the session and your /auth/callback route is hit.
      // From there you can route to (tabs) or signup completion.
    } catch (err: any) {
      console.warn("OAuth login failed", err);
      Alert.alert(
        "Login failed",
        err?.message ?? "Something went wrong while signing you in."
      );
      setLoadingProvider(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>
      <Text style={styles.subtitle}>
        Continue with Google or Apple to access your MuscleMetric account.
      </Text>

      <Pressable
        onPress={() => signInWithProvider("google")}
        style={styles.button}
        disabled={!!loadingProvider}
      >
        {loadingProvider === "google" ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonText}>Continue with Google</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => signInWithProvider("apple")}
        style={[styles.button, styles.buttonSecondary]}
        disabled={!!loadingProvider}
      >
        {loadingProvider === "apple" ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonTextSecondary}>Continue with Apple</Text>
        )}
      </Pressable>

      <View style={{ height: 24 }} />

      <Pressable
        onPress={() => router.push("/(auth)/signup")}
        style={styles.linkRow}
      >
        <Text style={styles.text}>
          New to MuscleMetric? <Text style={styles.link}>Create account</Text>
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
      marginBottom: 8,
      color: colors.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: colors.subtle,
      textAlign: "center",
      marginBottom: 24,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    buttonText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
    buttonSecondary: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    buttonTextSecondary: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    linkRow: { alignSelf: "center", marginTop: 8 },
    link: { color: colors.primaryText, fontWeight: "700" },
    text: { color: colors.text },
  });
