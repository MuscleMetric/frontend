// app/(auth)/login.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, Pressable } from "react-native";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import * as Linking from "expo-linking";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return Alert.alert("Login failed", error.message);

    async function ensureProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Minimal upsert if it doesn't exist yet
      await supabase.from("profiles").upsert({
        id: user.id,
        name: user.user_metadata?.name ?? null,
        email: user.email ?? null,
      });
    }

    // inside handleLogin() after no error:
    await ensureProfile();
    router.replace("/(tabs)");
    router.replace("/(tabs)");
  }

  async function handleForgotPassword() {
    if (!email) {
      Alert.alert(
        "Enter your email",
        "Type your email then tap 'Forgot password?'"
      );
      return;
    }
    const redirectTo = Linking.createURL("/(auth)/reset"); // e.g., musclemetric://(auth)/reset
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) return Alert.alert("Error", error.message);
    Alert.alert(
      "Check your email",
      "We sent you a link to reset your password."
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 16 }}>
        Log in
      </Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          marginBottom: 12,
          padding: 10,
          borderRadius: 8,
        }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          marginBottom: 12,
          padding: 10,
          borderRadius: 8,
        }}
      />

      <Button title="Log in" onPress={handleLogin} />

      <Pressable
        onPress={handleForgotPassword}
        style={{ alignSelf: "flex-start", marginTop: 12 }}
      >
        <Text style={{ color: "#2563eb", fontWeight: "700" }}>
          Forgot password?
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(auth)/signup")}
        style={{ alignSelf: "flex-start", marginTop: 16 }}
      >
        <Text>
          Don’t have an account?{" "}
          <Text style={{ color: "#2563eb", fontWeight: "700" }}>Sign up</Text>
        </Text>
      </Pressable>
    </View>
  );
}
