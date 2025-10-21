// app/_layout.tsx
import { Slot, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, loading } = useAuth();

  // This becomes defined once the NavigationContainer is mounted
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;

  // Avoid firing redirects multiple times
  const didRoute = useRef(false);

  // Handle Supabase deep links (magic link / reset)
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
    // Process the initial URL too
    Linking.getInitialURL().then(handleUrl);
    return () => sub.remove();
  }, []);

  // Auth redirects – only after nav is ready and auth finished loading
  useEffect(() => {
    if (!navReady) return;          // wait for navigator to mount
    if (loading) return;            // wait for auth
    if (didRoute.current) return;   // prevent double routing in dev Fast Refresh

    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) {
      didRoute.current = true;
      // next tick so it runs after this render commit
      setTimeout(() => router.replace("/(auth)/login"), 0);
      return;
    }
    if (session && inAuth) {
      didRoute.current = true;
      setTimeout(() => router.replace("/(tabs)"), 0);
    }
  }, [navReady, loading, session, segments, router]);

  // IMPORTANT: Always render a navigator on the first paint.
  // Slot renders child stacks/grids; never return null here.
  return <Slot />;
}
