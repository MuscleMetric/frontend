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
      router.replace("/callback");
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

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }

      if (result.type !== "success") {
        throw new Error("Google sign-in did not complete.");
      }

      // Deep link should already open /callback, but this keeps the flow deterministic.
      router.replace("/callback");
    } catch (e: any) {
      console.warn("Google sign-in failed:", e);
      Alert.alert(
        "Sign in failed",
        e?.message ?? "Could not continue with Google.",
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  async function signInWithApple() {
    try {
      setLoadingProvider("apple");

      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      console.log("[Apple] starting native sign-in", {
        appleAvailable,
        platform: Platform.OS,
      });

      let credential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce,
        });
      } catch (nativeErr: any) {
        console.warn("[Apple] native signInAsync failed", {
          code: nativeErr?.code ?? null,
          message: nativeErr?.message ?? null,
          name: nativeErr?.name ?? null,
          domain: nativeErr?.domain ?? null,
          nativeError:
            nativeErr?.nativeError ??
            nativeErr?.userInfo ??
            nativeErr?.cause ??
            null,
          fullError: nativeErr,
        });
        throw nativeErr;
      }

      console.log("[Apple] native credential received", {
        user: credential.user,
        email: credential.email,
        hasIdentityToken: !!credential.identityToken,
        hasAuthorizationCode: !!credential.authorizationCode,
        realUserStatus: credential.realUserStatus,
        fullName: credential.fullName,
      });

      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });

      console.log("[Apple] Supabase signInWithIdToken result", {
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorName: error?.name,
        errorStatus: (error as any)?.status,
      });

      if (error) throw error;

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
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              given_name: credential.fullName.givenName ?? null,
              family_name: credential.fullName.familyName ?? null,
            },
          });

          if (updateError) {
            console.warn("[Apple] updateUser failed", {
              code: updateError.code,
              message: updateError.message,
              name: updateError.name,
              status: (updateError as any)?.status,
            });
          }
        }
      }

      router.replace("/callback");
    } catch (e: any) {
      const code = e?.code ?? "UNKNOWN";
      const message = e?.message ?? "Could not continue with Apple.";

      console.warn("[Apple] sign-in failed", {
        code,
        message,
        name: e?.name ?? null,
        domain: e?.domain ?? null,
        nativeError: e?.nativeError ?? e?.userInfo ?? e?.cause ?? null,
        fullError: e,
      });

      if (code === "ERR_REQUEST_CANCELED") return;

      Alert.alert("Apple sign-in failed", `${code}: ${message}`);
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
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={
              colors.bg === "#000" || colors.text === "#fff"
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
          New users will continue to onboarding. Returning users will go
          straight back into the app.
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
