// app/(auth)/callback.tsx
import { useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function AuthCallback() {
  useEffect(() => {
    async function handleRedirect() {
      // tiny delay so Supabase can persist the session
      await new Promise((r) => setTimeout(r, 200));

      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);

      const session = sessionData.session;
      const user = userData.user;

      if (!session || !user) {
        router.replace("/(auth)/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("profiles lookup error:", error);
      }

      if (profile) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/onboarding");
      }
    }

    handleRedirect();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator />
      <Text style={{ marginTop: 10 }}>Signing you in…</Text>
    </View>
  );
}
