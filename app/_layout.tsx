// app/_layout.tsx
import "react-native-url-polyfill/auto";
import { useEffect } from "react";
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import * as Linking from "expo-linking";
import { ThemeProvider } from "@react-navigation/native";
import { useColorScheme, View, StyleSheet, Platform } from "react-native";
import { LightTheme, DarkTheme } from "./theme";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../lib/authContext";
import { SplashScreen } from "./_components/splashScreen";
import "react-native-get-random-values";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import { initSentry } from "./sentry";
import { registerForPushNotificationsAsync } from "@/lib/notifications/registerForPushNotifications";
import { saveDeviceToken } from "@/lib/notifications/saveDeviceToken";

import { ResumeWorkoutGate } from "@/app/features/workouts/components/ResumeWorkoutGate";
import { ActiveWorkoutSessionProvider } from "@/app/features/workouts/live/session/ActiveWorkoutSessionProvider";
import { ActiveWorkoutBar } from "@/app/features/workouts/live/session/ActiveWorkoutBar";

initSentry();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? DarkTheme : LightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={theme}>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { session, loading } = useAuth();

  const navState = useRootNavigationState();
  const navReady = !!navState?.key;

  // Route breadcrumbs
  useEffect(() => {
    if (!navReady) return;

    Sentry.addBreadcrumb({
      category: "navigation",
      message: "route",
      level: "info",
      data: {
        segments: (segments as string[])?.join("/"),
      },
    });
  }, [navReady, segments]);

  useEffect(() => {
    if (session?.user?.id) {
      Sentry.setUser({ id: session.user.id });
    } else {
      Sentry.setUser(null);
    }
  }, [session?.user?.id]);

  // Push registration
  useEffect(() => {
    let cancelled = false;

    const registerPush = async () => {
      const userId = session?.user?.id;
      if (!userId || loading) return;

      try {
        const result = await registerForPushNotificationsAsync();

        if (!result.granted || !result.expoPushToken || cancelled) {
          return;
        }

        await saveDeviceToken({
          userId,
          token: result.expoPushToken,
          platform: Platform.OS === "ios" ? "ios" : "android",
        });

        console.log("Push token saved successfully");
      } catch (error) {
        console.log("push registration error:", error);
        Sentry.captureException(error, {
          tags: { area: "notifications", action: "register_push_token" },
        });
      }
    };

    if (navReady && !loading && session?.user?.id) {
      registerPush();
    }

    return () => {
      cancelled = true;
    };
  }, [navReady, loading, session?.user?.id]);

  // Deep links + exchangeCodeForSession
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;

      const parsed = new URL(url);
      const code = parsed.searchParams.get("code");
      if (!code) return;

      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { area: "auth", action: "exchangeCodeForSession" },
        });
      }
    };

    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    Linking.getInitialURL().then(handleUrl);
    return () => sub.remove();
  }, []);

  // Auth redirects
  useEffect(() => {
    if (!navReady || loading) return;

    const segs = segments as string[];
    const inAuth = segs[0] === "(auth)";
    const sub = segs[1] as string | undefined;

    if (!session && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    const allowWhileAuthed = sub === "onboarding" || sub === "callback";
    if (session && inAuth && !allowWhileAuthed) {
      router.replace("/(tabs)");
    }
  }, [navReady, loading, session, segments, router]);

  const showSplash = !navReady || loading;

  return (
    <ActiveWorkoutSessionProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="features"
            options={{
              headerShown: false,
              headerTitle: "",
              headerBackTitle: "",
              headerShadowVisible: false,
              gestureEnabled: true,
            }}
          />
        </Stack>

        <ResumeWorkoutGate />
        <ActiveWorkoutBar />

        {showSplash ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="auto">
            <SplashScreen />
          </View>
        ) : null}
      </View>
    </ActiveWorkoutSessionProvider>
  );
}
