// app/_layout.tsx
import { Stack, useSegments, useRouter } from "expo-router";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const { session, loading } = useAuth();

  // Handle Supabase deep links (e.g., reset password)
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      try {
        await supabase.auth.exchangeCodeForSession(url);
      } catch (err) {
        console.error("Error exchanging code:", err);
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
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Stack>
          {/* Tabs and Auth groups (no headers) */}
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* All feature pages get automatic back + swipe gestures */}
          <Stack.Screen
            name="features/achievements"
            options={{
              title: "Achievements",
              headerBackTitle: "", // ✅ hides the back text safely
              headerBackVisible: true, // ✅ keeps the arrow visible
              gestureEnabled: true, // ✅ enables swipe-back on iOS
            }}
          />

          <Stack.Screen
            name="_features/goals"
            options={{
              title: "Goals",
              headerBackTitle: "",
              gestureEnabled: true,
            }}
          />
        </Stack>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
