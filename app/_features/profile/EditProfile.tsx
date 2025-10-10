import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";
import { router } from "expo-router";

export default function EditProfile() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, height, weight")
        .eq("id", userId)
        .single();
      if (!error && data) {
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setHeight(String(data.height ?? ""));
        setWeight(String(data.weight ?? ""));
      }
      setLoading(false);
    })();
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          email,
          height: height ? Number(height) : null,
          weight: weight ? Number(weight) : null,
        })
        .eq("id", userId);

      if (error) throw error;
      Alert.alert("Success", "Profile updated successfully!");
      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading)
    return (
      <View style={styles.centered}>
        <Text>Loading...</Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your name" />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="you@example.com"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Height (cm)</Text>
        <TextInput
          value={height}
          onChangeText={setHeight}
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 175"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          value={weight}
          onChangeText={setWeight}
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 70"
        />
      </View>

      <Pressable style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveText}>Save Changes</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#F7F8FA", flexGrow: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontWeight: "700", marginBottom: 6, color: "#374151" },
  input: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  saveBtn: {
    backgroundColor: "#0b6aa9",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  saveText: { color: "white", fontWeight: "700", fontSize: 16 },
});
