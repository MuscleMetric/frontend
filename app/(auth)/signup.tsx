// app/(auth)/signup.tsx
import React, { useMemo, useState } from "react";
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
import { useAppTheme } from "../../lib/useAppTheme";
import { useAuth } from "../../lib/useAuth";
import { router } from "expo-router";

export default function Signup() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { session } = useAuth();
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null
  );

  const user = session?.user ?? null;
  const meta = (user?.user_metadata || {}) as any;
  const provider = (user?.app_metadata as any)?.provider as
    | "google"
    | "apple"
    | undefined;

  const connectedEmail =
    user?.email ?? (meta.email as string | undefined) ?? null;

  const providerLabel =
    provider === "google"
      ? "Google"
      : provider === "apple"
      ? "Apple"
      : "your account";

  async function signInWithProvider(provider: "google" | "apple") {
    try {
      setOauthLoading(provider);

      // Must match Supabase redirect config (we already wired this up)
      const redirectTo = "musclemetric://callback";

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL returned from Supabase");

      await Linking.openURL(data.url);
      // After this:
      //  browser → Google/Apple → Supabase → musclemetric://callback
      //  callback.tsx runs → decides tabs vs onboarding
    } catch (e: any) {
      console.warn("OAuth sign-in failed:", e);
      Alert.alert(
        "Sign in failed",
        e?.message ?? "Could not sign in. Please try again."
      );
    } finally {
      setOauthLoading(null);
    }
  }

  function goToOnboarding() {
    if (!session) {
      Alert.alert(
        "Connect your account",
        "Please continue with Google or Apple first."
      );
      return;
    }
    router.replace("/(auth)/onboarding");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>
        Sign up with Google or Apple, then we’ll personalise your training.
      </Text>

      {/* OAuth buttons */}
      <Pressable
        onPress={() => signInWithProvider("google")}
        style={styles.button}
        disabled={!!oauthLoading}
      >
        {oauthLoading === "google" ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonText}>Continue with Google</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => signInWithProvider("apple")}
        style={[styles.button, styles.buttonSecondary]}
        disabled={!!oauthLoading}
      >
        {oauthLoading === "apple" ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonTextSecondary}>Continue with Apple</Text>
        )}
      </Pressable>

      {/* Connected account banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Connected account</Text>
        {session ? (
          <>
            <Text style={styles.bannerText}>
              You’re connected with{" "}
              <Text style={styles.bannerHighlight}>{providerLabel}</Text>
              {connectedEmail && (
                <Text style={styles.bannerText}> as {connectedEmail}</Text>
              )}
              .
            </Text>
            <Text style={styles.bannerSub}>
              Tap “Continue” to finish your profile and goals.
            </Text>
          </>
        ) : (
          <Text style={styles.bannerText}>
            Not connected yet. Choose Google or Apple above.
          </Text>
        )}
      </View>

      {/* Continue to onboarding */}
      <Pressable
        onPress={goToOnboarding}
        style={[styles.button, styles.continueButton]}
      >
        <Text style={styles.buttonText}>Continue to onboarding →</Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace("/(auth)/login")}
        style={styles.linkRow}
      >
        <Text style={styles.text}>
          Already have an account? <Text style={styles.link}>Log in</Text>
        </Text>
      </Pressable>
    </View>
  );
}

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
    continueButton: {
      marginTop: 8,
    },
    banner: {
      marginTop: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    bannerTitle: {
      fontWeight: "700",
      fontSize: 14,
      color: colors.text,
      marginBottom: 4,
    },
    bannerText: {
      color: colors.text,
      fontSize: 13,
    },
    bannerHighlight: {
      fontWeight: "700",
      color: colors.primaryText,
    },
    bannerSub: {
      marginTop: 4,
      fontSize: 12,
      color: colors.subtle,
    },
    linkRow: { alignSelf: "center", marginTop: 16 },
    link: { color: colors.primaryText, fontWeight: "700" },
    text: { color: colors.text },
  });
