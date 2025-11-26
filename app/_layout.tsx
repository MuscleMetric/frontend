// app/_layout.tsx
import "react-native-url-polyfill/auto";
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import React, { useEffect, useRef } from "react";
import * as Linking from "expo-linking";
import { ThemeProvider } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { LightTheme, DarkTheme } from "./theme";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, loading } = useAuth();

  const scheme = useColorScheme();
  const theme = scheme === "dark" ? DarkTheme : LightTheme;

  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const didRoute = useRef(false);

  // 🔹 Deep links + exchangeCodeForSession
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      console.log("🔗 [RootLayout] Received URL:", url);

      // Only handle URLs that actually have a `code` param
      const parsed = new URL(url);
      const code = parsed.searchParams.get("code");

      if (!code) {
        console.log("   ℹ️ No `code` param in URL, ignoring.");
        return;
      }

      try {
        const before = await supabase.auth.getSession();
        console.log(
          "   🕒 Session before exchange:",
          !!before.data.session,
          before.data.session?.user?.id
        );

        const { data, error } = await supabase.auth.exchangeCodeForSession(
          code
        );
        console.log("   🔄 exchangeCodeForSession(code) result:", {
          error,
          hasSession: !!data.session,
          userId: data.session?.user?.id,
        });

        const after = await supabase.auth.getSession();
        console.log(
          "   ✅ Session after exchange:",
          !!after.data.session,
          after.data.session?.user?.id
        );
      } catch (err) {
        console.warn("❌ exchangeCodeForSession failed:", err);
      }
    };

    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    Linking.getInitialURL().then(handleUrl);
    return () => sub.remove();
  }, []);

  //    const segs = segments as string[];

  // inside RootLayout, in the "Auth redirects" useEffect:
  useEffect(() => {
    if (!navReady || loading || didRoute.current) return;

    const segs = segments as string[];

    const inAuth = segs[0] === "(auth)";
    const sub = segs[1] as string | undefined;

    if (!session && !inAuth) {
      didRoute.current = true;
      setTimeout(() => router.replace("/(auth)/login"), 0);
      return;
    }

    // Allow onboarding + callback to be visited while logged-in
    const allowWhileAuthed = sub === "onboarding" || sub === "callback";

    if (session && inAuth && !allowWhileAuthed) {
      didRoute.current = true;
      setTimeout(() => router.replace("/(tabs)"), 0);
    }
  }, [navReady, loading, session, segments, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />

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
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
