import { useEffect } from "react";
import { ActivityIndicator, View, Text, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

async function waitForSession(maxAttempts = 10, delayMs = 300) {
  for (let i = 0; i < maxAttempts; i++) {
    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);

    const session = sessionData.session;
    const user = userData.user;

    if (session && user) {
      return { session, user };
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }

  return { session: null, user: null };
}

export default function AuthCallback() {
  useEffect(() => {
    let alive = true;

    async function handleRedirect() {
      try {
        console.log("[callback] mounted");

        const { session, user } = await waitForSession();

        if (!alive) return;

        console.log("[callback] waitForSession result", {
          hasSession: !!session,
          hasUser: !!user,
        });

        if (!session || !user) {
          console.warn("[callback] no session/user after waiting");
          router.replace("/login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!alive) return;

        console.log("[callback] profile lookup result", {
          hasProfile: !!profile,
          error,
        });

        if (error) {
          console.warn("[callback] profiles lookup error:", error);
          router.replace("/login");
          return;
        }

        if (profile) {
          console.log("[callback] routing to /");
          router.replace("/");
        } else {
          console.log("[callback] routing to /onboarding");
          router.replace("/onboarding");
        }
      } catch (err) {
        console.warn("[callback] unexpected error:", err);

        if (!alive) return;

        Alert.alert(
          "Sign in issue",
          "We couldn't finish signing you in. Please try again.",
        );
        router.replace("/login");
      }
    }

    void handleRedirect();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <ActivityIndicator />
      <Text style={{ marginTop: 10 }}>Signing you in…</Text>
    </View>
  );
}