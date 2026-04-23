import { useEffect } from "react";
import { ActivityIndicator, View, Text, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

type WaitResult = {
  session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null;
  user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] | null;
  attempts: number;
};

async function waitForSession(maxAttempts = 10, delayMs = 300): Promise<WaitResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const attempt = i + 1;

    const startedAt = Date.now();
    const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
      await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);
    const elapsedMs = Date.now() - startedAt;

    const session = sessionData.session;
    const user = userData.user;

    console.log("[callback] waitForSession attempt", {
      attempt,
      elapsedMs,
      hasSession: !!session,
      hasUser: !!user,
      sessionUserId: session?.user?.id ?? null,
      userId: user?.id ?? null,
      sessionError: sessionError
        ? {
            message: sessionError.message,
            name: sessionError.name,
            status: (sessionError as any)?.status ?? null,
          }
        : null,
      userError: userError
        ? {
            message: userError.message,
            name: userError.name,
            status: (userError as any)?.status ?? null,
          }
        : null,
    });

    if (session && user) {
      return { session, user, attempts: attempt };
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }

  return { session: null, user: null, attempts: maxAttempts };
}

export default function AuthCallback() {
  useEffect(() => {
    let alive = true;

    async function handleRedirect() {
      const callbackStartedAt = Date.now();

      try {
        console.log("[callback] mounted", {
          startedAt: new Date(callbackStartedAt).toISOString(),
        });

        const {
          data: { session: immediateSession },
        } = await supabase.auth.getSession();

        console.log("[callback] immediate getSession", {
          hasImmediateSession: !!immediateSession,
          immediateUserId: immediateSession?.user?.id ?? null,
        });

        const { session, user, attempts } = await waitForSession();

        if (!alive) {
          console.log("[callback] aborted after waitForSession");
          return;
        }

        console.log("[callback] waitForSession final result", {
          attempts,
          hasSession: !!session,
          hasUser: !!user,
          sessionUserId: session?.user?.id ?? null,
          userId: user?.id ?? null,
          totalElapsedMs: Date.now() - callbackStartedAt,
        });

        if (!session || !user) {
          console.warn("[callback] no session/user after waiting", {
            attempts,
            totalElapsedMs: Date.now() - callbackStartedAt,
          });
          router.replace("/login");
          return;
        }

        const profileStartedAt = Date.now();

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, onboarding_step, onboarding_completed_at")
          .eq("id", user.id)
          .maybeSingle();

        if (!alive) {
          console.log("[callback] aborted after profile lookup");
          return;
        }

        console.log("[callback] profile lookup result", {
          hasProfile: !!profile,
          profileId: profile?.id ?? null,
          onboardingStep: (profile as any)?.onboarding_step ?? null,
          onboardingCompletedAt: (profile as any)?.onboarding_completed_at ?? null,
          error: error
            ? {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
              }
            : null,
          elapsedMs: Date.now() - profileStartedAt,
          totalElapsedMs: Date.now() - callbackStartedAt,
        });

        if (error) {
          console.warn("[callback] profiles lookup error:", error);
          router.replace("/login");
          return;
        }

        if (profile) {
          console.log("[callback] routing to /(tabs)", {
            totalElapsedMs: Date.now() - callbackStartedAt,
          });
          router.replace("/(tabs)");
        } else {
          console.log("[callback] routing to /onboarding", {
            totalElapsedMs: Date.now() - callbackStartedAt,
          });
          router.replace("/onboarding");
        }
      } catch (err: any) {
        console.warn("[callback] unexpected error", {
          message: err?.message ?? null,
          name: err?.name ?? null,
          status: err?.status ?? null,
          stack: err?.stack ?? null,
          totalElapsedMs: Date.now() - callbackStartedAt,
        });

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
      console.log("[callback] unmounted");
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