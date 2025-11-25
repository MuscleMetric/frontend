// app/callback.tsx (not inside (auth))
import { useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase"; 

export default function AuthCallback() {
  useEffect(() => {
    async function handleRedirect() {
      await new Promise((r) => setTimeout(r, 400));

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/signup");
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
