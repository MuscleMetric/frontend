// app/(auth)/reset.tsx
import { useState } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSetPassword() {
    if (!password || password.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert("Couldn't reset password", error.message);
      return;
    }

    Alert.alert("Success", "Your password has been updated.");
    router.replace("/(tabs)");
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 16 }}>
        Set a new password
      </Text>
      <TextInput
        placeholder="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, marginBottom: 12, padding: 10, borderRadius: 8 }}
      />
      <TextInput
        placeholder="Confirm password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        style={{ borderWidth: 1, marginBottom: 12, padding: 10, borderRadius: 8 }}
      />
      <Button title={loading ? "Saving..." : "Save password"} onPress={handleSetPassword} />
    </View>
  );
}
