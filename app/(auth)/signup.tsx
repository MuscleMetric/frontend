import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Pressable,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Modal,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";

type Level = "beginner" | "intermediate" | "advanced";
type Goal = "build_muscle" | "lose_fat" | "get_stronger" | "improve_endurance";
type Gender = "male" | "female" | "other";

export default function Signup() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // step 2 (reworked)
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [height, setHeight] = useState<string>(""); // cm
  const [weight, setWeight] = useState<string>(""); // kg

  function openDobPicker() {
    Keyboard.dismiss();
    setShowDobPicker(true);
  }
  function closeDobPicker() {
    setShowDobPicker(false);
  }
  function confirmDob(date: Date) {
    setDob(date);
    closeDobPicker();
  }

  // step 3
  const [level, setLevel] = useState<Level>("beginner");
  const [primaryGoal, setPrimaryGoal] = useState<Goal>("build_muscle");
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState<number>(3);

  const [loading, setLoading] = useState(false);

  function calcAge(d: Date | null) {
    if (!d) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
  }

  function next() {
    if (step === 1) {
      const okEmail = /\S+@\S+\.\S+/.test(email);
      if (!fullName || !okEmail || password.length < 6) {
        Alert.alert(
          "Please fill your name, a valid email, and a 6+ character password."
        );
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!dob || !gender || !height || !weight) {
        Alert.alert(
          "Please select your date of birth, gender, height, and weight."
        );
        return;
      }
      setStep(3);
    }
  }

  async function complete() {
    try {
      setLoading(true);

      // 1) Create auth user (store name + gender in user_metadata for convenience)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp(
        {
          email,
          password,
          options: { data: { name: fullName, gender } },
        }
      );
      if (signUpErr) throw signUpErr;

      const userId = signUpData.user?.id || signUpData.session?.user.id;

      // 2) Upsert profile (height/weight numeric columns; extra info in settings)
      if (userId) {
        const profilePayload: any = {
          id: userId,
          name: fullName,
          email,
          // align with your current schema (you've been using `height` and `weight`)
          height: height ? Number(height) : null,
          weight: weight ? Number(weight) : null,
          settings: {
            gender,
            dob: dob ? dob.toISOString().slice(0, 10) : null, // YYYY-MM-DD
            level,
            primaryGoal,
            workoutsPerWeek,
            unit_weight: "kg",
            unit_height: "cm",
          },
        };

        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert(profilePayload);
        if (upsertErr) throw upsertErr;
      } else {
        Alert.alert(
          "Confirm your email",
          "We’ve sent a confirmation link. After confirming, sign in and your profile will be finalized."
        );
      }

      // 3) Route depending on whether email confirmation is required
      if (signUpData.session) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/login");
      }
    } catch (e: any) {
      Alert.alert("Sign up failed", e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function onChangeDob(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") setShowDobPicker(false);
    if (date) setDob(date);
  }

  const age = calcAge(dob);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: "#F7F8FA" }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Header
          title="Create Account"
          subtitle={
            step === 1
              ? "Let's get started with your fitness journey"
              : step === 2
              ? "Tell us about yourself"
              : "Set your fitness goals"
          }
          step={step}
        />

        {/* CARD */}
        <View style={styles.card}>
          {step === 1 && (
            <>
              <Field label="Full Name">
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </Field>
              <Field label="Email">
                <TextInput
                  style={styles.input}
                  placeholder="your.email@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </Field>
              <Field label="Password">
                <TextInput
                  style={styles.input}
                  placeholder="Create a password (min 6 characters)"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </Field>
              <Button title="Next  →" onPress={next} />
            </>
          )}

          {step === 2 && (
            <>
              {/* Date of Birth */}
              <Field label="Date of Birth">
                <Pressable
                  style={[styles.input, { justifyContent: "center" }]}
                  onPress={openDobPicker}
                >
                  <Text style={{ color: "#111827" }}>
                    {dob
                      ? dob.toDateString()
                      : "Tap to select your date of birth"}
                  </Text>
                </Pressable>

                {age != null && (
                  <Text style={{ marginTop: 6, color: "#6b7280" }}>
                    Age:{" "}
                    <Text style={{ fontWeight: "700", color: "#111827" }}>
                      {age}
                    </Text>
                  </Text>
                )}
              </Field>

              {/* Gender chips */}
              <Field label="Gender">
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["male", "female", "other"] as Gender[]).map((g) => {
                    const active = gender === g;
                    return (
                      <Pressable
                        key={g}
                        onPress={() => setGender(g)}
                        style={[
                          styles.chip,
                          active ? { backgroundColor: "#2563eb" } : null,
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? "white" : "#111827",
                            fontWeight: "700",
                            textTransform: "capitalize",
                          }}
                        >
                          {g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              {/* Height & Weight */}
              <Field label="Height (cm)">
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 175"
                  keyboardType="decimal-pad"
                  value={height}
                  onChangeText={setHeight}
                />
              </Field>

              <Field label="Weight (kg)">
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 70"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />
              </Field>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button title="←  Back" onPress={() => setStep(1)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Next  →" onPress={next} />
                </View>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Current Fitness Level">
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={level}
                    onValueChange={(v: Level) => setLevel(v)}
                  >
                    <Picker.Item label="Beginner" value="beginner" />
                    <Picker.Item label="Intermediate" value="intermediate" />
                    <Picker.Item label="Advanced - 2+ years" value="advanced" />
                  </Picker>
                </View>
              </Field>

              <Field label="Primary Fitness Goal">
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={primaryGoal}
                    onValueChange={(v: Goal) => setPrimaryGoal(v)}
                  >
                    <Picker.Item label="Build Muscle" value="build_muscle" />
                    <Picker.Item label="Lose Fat" value="lose_fat" />
                    <Picker.Item label="Get Stronger" value="get_stronger" />
                    <Picker.Item
                      label="Improve Endurance"
                      value="improve_endurance"
                    />
                  </Picker>
                </View>
              </Field>

              <Field label="Workouts Per Week">
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={workoutsPerWeek}
                    onValueChange={(v) => setWorkoutsPerWeek(Number(v))}
                  >
                    <Picker.Item label="3 workouts" value={3} />
                    <Picker.Item label="4 workouts" value={4} />
                    <Picker.Item label="5 workouts" value={5} />
                  </Picker>
                </View>
              </Field>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button title="←  Back" onPress={() => setStep(2)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={loading ? "Creating..." : "Complete  ✓"}
                    onPress={complete}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        <Pressable
          onPress={() => router.replace("/(auth)/login")}
          style={{ alignSelf: "center", marginTop: 16 }}
        >
          <Text>
            Already have an account?{" "}
            <Text style={{ color: "#2563eb", fontWeight: "700" }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
      
      {/* DOB picker – only while editing */}
      {showDobPicker &&
        (Platform.OS === "android" ? (
          <DateTimePicker
            value={dob ?? new Date(2000, 0, 1)}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={onChangeDob}
          />
        ) : (
          <DobSheet
            initialDate={dob ?? new Date(2000, 0, 1)}
            onCancel={closeDobPicker}
            onConfirm={(d) => {
              setDob(d);
              closeDobPicker();
            }}
          />
        ))}
    </KeyboardAvoidingView>
  );
}

/* ---------- small UI components ---------- */
function Header({
  title,
  subtitle,
  step,
}: {
  title: string;
  subtitle: string;
  step: 1 | 2 | 3;
}) {
  return (
    <View style={{ alignItems: "center", marginTop: 8, marginBottom: 16 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          backgroundColor: "#2563eb",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Text style={{ color: "white", fontSize: 28 }}>🏋️</Text>
      </View>
      <Text style={{ fontSize: 20, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: "#6b7280", marginTop: 4 }}>{subtitle}</Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: step >= (n as 1 | 2 | 3) ? "#2563eb" : "#e5e7eb",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 12 }}>{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DobSheet({
  initialDate,
  onConfirm,
  onCancel,
}: {
  initialDate: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  if (Platform.OS === "android") {
    // Android: use the native modal picker (inline modal handled by the lib)
    return (
      <DateTimePicker
        value={initialDate}
        mode="date"
        display="default"
        maximumDate={new Date()}
        onChange={(e, date) => {
          if (e.type === "set" && date) onConfirm(date);
          else onCancel();
        }}
      />
    );
  }

  // iOS: make a small bottom sheet with Done/Cancel
  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={dobStyles.backdrop} onPress={onCancel} />
      <View style={dobStyles.sheet}>
        <View style={dobStyles.toolbar}>
          <Pressable onPress={onCancel}>
            <Text style={dobStyles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={dobStyles.title}>Select Date of Birth</Text>
          <Pressable onPress={() => onConfirm(tempRef.current ?? initialDate)}>
            <Text style={dobStyles.done}>Done</Text>
          </Pressable>
        </View>
        <DateTimePicker
          value={initialDate}
          mode="date"
          display="spinner"
          maximumDate={new Date()}
          onChange={(_, date) => {
            if (date) tempRef.current = date;
          }}
        />
      </View>
    </Modal>
  );
}

// keep a temp ref for iOS spinner to capture changes before "Done"
import { useRef } from "react";
const tempRef = { current: undefined as Date | undefined };

const dobStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  title: { fontWeight: "700" },
  cancel: { color: "#6b7280", fontWeight: "600" },
  done: { color: "#2563eb", fontWeight: "700" },
});

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ marginBottom: 6, fontWeight: "700" }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "white",
    color: "#111827", // visible dark text
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
  },
});
