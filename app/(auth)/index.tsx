// app/(auth)/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";

import { supabase } from "../../lib/supabase";
import { useAppTheme } from "../../lib/useAppTheme";
import { useAuth } from "../../lib/authContext";

WebBrowser.maybeCompleteAuthSession();

type LoadingProvider = "google" | "apple" | null;

export default function AuthIndex() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { session, loading } = useAuth();

  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAppleAvailability() {
      if (Platform.OS !== "ios") {
        if (mounted) setAppleAvailable(false);
        return;
      }

      try {
        const available = await AppleAuthentication.isAvailableAsync();
        if (mounted) setAppleAvailable(available);
      } catch {
        if (mounted) setAppleAvailable(false);
      }
    }

    void checkAppleAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && session) {
      // If auth state is already ready, let callback/profile logic decide the next route.
      router.replace("/(auth)/callback");
    }
  }, [loading, session]);

  async function signInWithGoogle() {
    try {
      setLoadingProvider("google");

      const redirectTo = Linking.createURL("/callback");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No Google auth URL returned.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }

      if (result.type !== "success") {
        throw new Error("Google sign-in did not complete.");
      }

      // Deep link should already open /callback, but this keeps the flow deterministic.
      router.replace("/(auth)/callback");
    } catch (e: any) {
      console.warn("Google sign-in failed:", e);
      Alert.alert(
        "Sign in failed",
        e?.message ?? "Could not continue with Google."
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  async function signInWithApple() {
    try {
      setLoadingProvider("apple");

      const nonce = Crypto.randomUUID();

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });

      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce,
      });

      if (error) throw error;

      // Apple only gives name on first sign-in. Save it while we have it.
      if (credential.fullName) {
        const fullName = [
          credential.fullName.givenName,
          credential.fullName.middleName,
          credential.fullName.familyName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        if (fullName) {
          await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              given_name: credential.fullName.givenName ?? null,
              family_name: credential.fullName.familyName ?? null,
            },
          });
        }
      }

      router.replace("/(auth)/callback");
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") {
        return;
      }

      console.warn("Apple sign-in failed:", e);
      Alert.alert(
        "Sign in failed",
        e?.message ?? "Could not continue with Apple."
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to MuscleMetric</Text>
      <Text style={styles.subtitle}>
        Continue with Apple or Google to create or access your account.
      </Text>

      {Platform.OS === "ios" && appleAvailable ? (
        <View style={styles.appleButtonWrap}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              colors.bg === "#000" ||
              colors.text === "#fff"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={styles.appleButton}
            onPress={signInWithApple}
          />
          {loadingProvider === "apple" && (
            <View style={styles.inlineLoadingRow}>
              <ActivityIndicator />
              <Text style={styles.inlineLoadingText}>
                Connecting with Apple…
              </Text>
            </View>
          )}
        </View>
      ) : null}

      <Pressable
        onPress={signInWithGoogle}
        style={[
          styles.button,
          loadingProvider ? styles.buttonDisabled : undefined,
        ]}
        disabled={!!loadingProvider}
      >
        {loadingProvider === "google" ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.buttonText}>Continue with Google</Text>
        )}
      </Pressable>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>One account flow</Text>
        <Text style={styles.infoText}>
          New users will continue to onboarding. Returning users will go straight
          back into the app.
        </Text>
      </View>

      <Text style={styles.footer}>
        By continuing, you agree to MuscleMetric’s Terms and Privacy Policy.
      </Text>
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
      fontSize: 30,
      fontWeight: "800",
      marginBottom: 10,
      color: colors.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 15,
      color: colors.subtle,
      textAlign: "center",
      marginBottom: 28,
      lineHeight: 22,
    },
    appleButtonWrap: {
      marginBottom: 12,
    },
    appleButton: {
      width: "100%",
      height: 50,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
    inlineLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 10,
    },
    inlineLoadingText: {
      color: colors.subtle,
      fontSize: 13,
    },
    infoCard: {
      marginTop: 10,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    infoTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 4,
    },
    infoText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    footer: {
      marginTop: 20,
      textAlign: "center",
      color: colors.subtle,
      fontSize: 12,
      lineHeight: 18,
    },
  });