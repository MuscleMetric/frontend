// app/.../EditProfile.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";
import { router } from "expo-router";
import { useAppTheme } from "../../../lib/useAppTheme";

/* ---------- helpers ---------- */
function toISODate(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD
}
function parseISODate(s?: string | null) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const LEVEL_OPTIONS = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const GOAL_OPTIONS = [
  { key: "build_muscle", label: "Build muscle" },
  { key: "lose_fat", label: "Lose fat" },
  { key: "get_stronger", label: "Get stronger" },
  { key: "improve_fitness", label: "Improve fitness" },
];

export default function EditProfile() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // settings JSON from profiles.settings (we keep a copy so we don't lose other keys)
  const [settings, setSettings] = useState<any>({});
  const [level, setLevel] = useState<string>("intermediate");
  const [primaryGoal, setPrimaryGoal] = useState<string>("build_muscle");

  // DOB state
  const [dobIso, setDobIso] = useState<string>("");
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [tempDobDate, setTempDobDate] = useState<Date>(new Date(2000, 0, 1));

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, height, weight, date_of_birth, settings")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("EditProfile load error", error);
      }

      if (data) {
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

        const s = data.settings ?? {};
        setSettings(s);
        setLevel(s.level ?? "intermediate");
        setPrimaryGoal(s.primaryGoal ?? "build_muscle");
      }
      setLoading(false);
    })();
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    try {
      setLoading(true);

      const newSettings = {
        ...(settings ?? {}),
        level,
        primaryGoal,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          email,
          height: height ? Number(height) : null,
          weight: weight ? Number(weight) : null,
          date_of_birth: dobIso || null,
          settings: newSettings,
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
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with back button */}
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backBtn}
            hitSlop={8}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Edit Profile</Text>
          {/* spacer to balance layout */}
          <View style={{ width: 32 }} />
        </View>

        {/* Name / Email */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.subtle}
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
              placeholderTextColor={colors.subtle}
            />
          </View>
        </View>

        {/* Physical stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Body stats</Text>
          <View style={styles.row2}>
            <View style={[styles.inputGroup, styles.flexItem]}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                value={height}
                onChangeText={setHeight}
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 175"
                placeholderTextColor={colors.subtle}
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
                placeholderTextColor={colors.subtle}
              />
            </View>
          </View>

          {/* DOB */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of birth</Text>
            <Pressable
              style={[styles.input, { justifyContent: "center" }]}
              onPress={() => setShowDobPicker(true)}
            >
              <Text style={{ color: dobIso ? colors.text : colors.subtle }}>
                {dobIso || "Select date"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Training preferences */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Training profile</Text>

          {/* Fitness level pills */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fitness level</Text>
            <View style={styles.chipRow}>
              {LEVEL_OPTIONS.map((opt) => {
                const active = level === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setLevel(opt.key)}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: colors.primaryBg ?? colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        active && {
                          color: colors.primaryText ?? "#fff",
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Primary goal pills */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Primary goal</Text>
            <View style={styles.chipWrap}>
              {GOAL_OPTIONS.map((opt) => {
                const active = primaryGoal === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setPrimaryGoal(opt.key)}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: colors.primaryBg ?? colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        active && {
                          color: colors.primaryText ?? "#fff",
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>Save changes</Text>
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
            <Text style={styles.h3}>Select date of birth</Text>
            <DateTimePicker
              value={tempDobDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
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

/* ---------- themed styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 20,
      paddingBottom: 32,
      gap: 16,
    },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    backIcon: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
      color: colors.text,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 8,
      color: colors.subtle,
    },

    inputGroup: { marginBottom: 12 },
    row2: {
      flexDirection: "row",
      gap: 12,
    },
    flexItem: { flex: 1 },

    label: {
      fontWeight: "700",
      marginBottom: 6,
      color: colors.text,
      fontSize: 13,
    },

    input: {
      backgroundColor: colors.surface ?? colors.card,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      color: colors.text,
    },

    chipRow: {
      flexDirection: "row",
      gap: 8,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface ?? colors.card,
    },
    chipLabel: {
      fontSize: 13,
      color: colors.text,
    },

    saveBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 4,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    saveText: {
      color: colors.onPrimary ?? "#fff",
      fontWeight: "700",
      fontSize: 16,
    },

    // modal
    modalScrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    h3: { fontSize: 16, fontWeight: "800", marginBottom: 8, color: colors.text },

    btn: {
      backgroundColor: colors.surface,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnText: { fontWeight: "700", color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    primaryText: { color: colors.onPrimary ?? "#fff", fontWeight: "800" },
  });
