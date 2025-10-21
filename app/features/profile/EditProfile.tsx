// app/.../EditProfile.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";
import { router } from "expo-router";

/* ---------- helpers ---------- */
function toISODate(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD
}
function parseISODate(s?: string | null) {
  if (!s) return null;
  // Treat as YYYY-MM-DD without time zone
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function EditProfile() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // DOB state
  const [dobIso, setDobIso] = useState<string>(""); // YYYY-MM-DD for saving
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [tempDobDate, setTempDobDate] = useState<Date>(new Date(2000, 0, 1));

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, height, weight, date_of_birth")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setHeight(data.height != null ? String(data.height) : "");
        setWeight(data.weight != null ? String(data.weight) : "");

        const d = parseISODate(data.date_of_birth);
        if (d) {
          setDobIso(toISODate(d));
          setTempDobDate(d);
        } else {
          setDobIso("");
          setTempDobDate(new Date(2000, 0, 1));
        }
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
          date_of_birth: dobIso || null, // <- ISO string or null
        })
        .eq("id", userId);

      if (error) throw error;
      Alert.alert("Success", "Profile updated successfully!");
      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message ?? "Could not update profile.");
    } finally {
      setLoading(false);
    }
  }

  if (loading)
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <View style={styles.centered}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Edit Profile</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Your name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.row2}>
          <View style={[styles.inputGroup, styles.flexItem]}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              value={height}
              onChangeText={setHeight}
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 175"
            />
          </View>

          <View style={[styles.inputGroup, styles.flexItem]}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 70"
            />
          </View>
        </View>

        {/* DOB with native date picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date of Birth</Text>
          <Pressable
            style={[styles.input, { justifyContent: "center" }]}
            onPress={() => setShowDobPicker(true)}
          >
            <Text style={{ color: dobIso ? "#111827" : "#9CA3AF" }}>
              {dobIso || "Select date"}
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>Save Changes</Text>
        </Pressable>
      </ScrollView>

      {/* Date picker modal */}
      <Modal
        visible={showDobPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDobPicker(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.h3}>Select Date of Birth</Text>
            <DateTimePicker
              value={tempDobDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()} // can't be in the future
              onChange={(_, d) => d && setTempDobDate(d)}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable
                style={[styles.btn, { flex: 1 }]}
                onPress={() => setShowDobPicker(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.primary, { flex: 1 }]}
                onPress={() => {
                  setDobIso(toISODate(tempDobDate));
                  setShowDobPicker(false);
                }}
              >
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  container: {
    padding: 20,
    paddingBottom: 32,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
  },
  inputGroup: { marginBottom: 16 },
  row2: {
    flexDirection: "row",
    gap: 12,
  },
  flexItem: { flex: 1 },
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

  // modal
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  h3: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  btn: {
    backgroundColor: "#EEF2F6",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { fontWeight: "700", color: "#111827" },
  primary: { backgroundColor: "#2563eb" },
  primaryText: { color: "#fff", fontWeight: "800" },
});
