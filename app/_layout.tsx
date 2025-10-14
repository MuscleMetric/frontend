// app/_layout.tsx
import { Stack, useSegments, useRouter } from "expo-router";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const { session, loading } = useAuth();

  // Handle Supabase deep links (e.g., reset password / magic link)
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

  // Auth redirect logic
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) router.replace("/(auth)/login");
    if (session && inAuth) router.replace("/(tabs)");
  }, [segments, session, loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Route groups only. Child stacks render their own headers */}
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="features" />
    </Stack>
  );
}