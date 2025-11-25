// app/_layout.tsx
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

  // 🔹 Device theme (auto-updates if the user toggles system dark mode)
  const scheme = useColorScheme(); // 'light' | 'dark' | null
  const theme = scheme === "dark" ? DarkTheme : LightTheme;

  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const didRoute = useRef(false);

  // Deep links
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      try {
        await supabase.auth.exchangeCodeForSession(url);
      } catch (err) {
        console.warn("exchangeCodeForSession failed:", err);
      }
    };
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    Linking.getInitialURL().then(handleUrl);
    return () => sub.remove();
  }, []);

  // Auth redirects
  useEffect(() => {
    if (!navReady || loading || didRoute.current) return;

    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) {
      didRoute.current = true;
      setTimeout(() => router.replace("/(auth)/login"), 0);
      return;
    }
    if (session && inAuth) {
      didRoute.current = true;
      setTimeout(() => router.replace("/(tabs)"), 0);
    }
  }, [navReady, loading, session, segments, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        {/* Status bar adapts to theme */}
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="features"
            options={{
              headerShown: false, // keep child stacks in /features controlling their own headers
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
