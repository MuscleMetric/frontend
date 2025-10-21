// app/(auth)/change-password.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function handleChange() {
    if (!password || password.length < 6) return Alert.alert("Use at least 6 characters");
    if (password !== confirm) return Alert.alert("Passwords don't match");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return Alert.alert("Error", error.message);
    Alert.alert("Updated", "Your password has been changed.");
    router.back();
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 12 }}>Change Password</Text>
      <TextInput secureTextEntry placeholder="New password" value={password} onChangeText={setPassword}
        style={{ borderWidth: 1, marginBottom: 12, padding: 10, borderRadius: 8 }} />
      <TextInput secureTextEntry placeholder="Confirm password" value={confirm} onChangeText={setConfirm}
        style={{ borderWidth: 1, marginBottom: 12, padding: 10, borderRadius: 8 }} />
      <Button title="Save" onPress={handleChange} />
    </View>
  );
}
