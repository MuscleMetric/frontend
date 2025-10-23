// app/(auth)/signup.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Modal,
  ActivityIndicator,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAppTheme } from "../../lib/useAppTheme";
import { toISODateUTC } from "../utils/dates";

type Level = "beginner" | "intermediate" | "advanced";
type Goal = "build_muscle" | "lose_fat" | "get_stronger" | "improve_endurance";
type Gender = "male" | "female" | "other";

export default function Signup() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // step 2
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");

  // step 3
  const [level, setLevel] = useState<Level>("beginner");
  const [primaryGoal, setPrimaryGoal] = useState<Goal>("build_muscle");
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState<number>(3);
  const [stepsGoal, setStepsGoal] = useState<string>("10000");

  const [loading, setLoading] = useState(false);

  function calcAge(d: Date | null) {
    if (!d) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
  }
  const age = calcAge(dob);

  function openDobPicker() {
    Keyboard.dismiss();
    setShowDobPicker(true);
  }
  function closeDobPicker() {
    setShowDobPicker(false);
  }
  function onChangeDob(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") setShowDobPicker(false);
    if (date) setDob(date);
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

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp(
        {
          email,
          password,
          options: { data: { name: fullName, gender } },
        }
      );
      if (signUpErr) throw signUpErr;

      const userId = signUpData.user?.id || signUpData.session?.user.id;

      if (userId) {
        const profilePayload: any = {
          id: userId,
          name: fullName,
          email,
          height: height ? Number(height) : null,
          weight: weight ? Number(weight) : null,
          date_of_birth: dob ? toISODateUTC(dob) : null,
          steps_goal: Math.max(0, Number(stepsGoal) || 0),
          settings: {
            gender,
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

      if (signUpData.session) router.replace("/(tabs)");
      else router.replace("/(auth)/login");
    } catch (e: any) {
      Alert.alert("Sign up failed", e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
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
                  placeholderTextColor={colors.subtle}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </Field>
              <Field label="Email">
                <TextInput
                  style={styles.input}
                  placeholder="your.email@example.com"
                  placeholderTextColor={colors.subtle}
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
                  placeholderTextColor={colors.subtle}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </Field>

              <PrimaryButton title="Next  →" onPress={next} />
            </>
          )}

          {step === 2 && (
            <>
              {/* DOB */}
              <Field label="Date of Birth">
                <Pressable
                  style={[styles.input, { justifyContent: "center" }]}
                  onPress={openDobPicker}
                >
                  <Text style={{ color: colors.text }}>
                    {dob
                      ? dob.toDateString()
                      : "Tap to select your date of birth"}
                  </Text>
                </Pressable>

                {age != null && (
                  <Text style={{ marginTop: 6, color: colors.subtle }}>
                    Age:{" "}
                    <Text style={{ fontWeight: "700", color: colors.text }}>
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
                          active && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active
                              ? colors.primary ?? "#fff"
                              : colors.text,
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
                  placeholderTextColor={colors.subtle}
                  keyboardType="decimal-pad"
                  value={height}
                  onChangeText={setHeight}
                />
              </Field>

              <Field label="Weight (kg)">
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 70"
                  placeholderTextColor={colors.subtle}
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />
              </Field>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton title="←  Back" onPress={() => setStep(1)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Next  →" onPress={next} />
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

              <Field label="Daily Steps Goal">
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 10000"
                    placeholderTextColor={colors.subtle}
                    keyboardType="number-pad"
                    value={stepsGoal}
                    onChangeText={setStepsGoal}
                  />

                  {/* Optional quick chips */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[8000, 10000, 12000].map((n) => (
                      <Pressable
                        key={n}
                        style={[
                          styles.chip,
                          stepsGoal === String(n) && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                        onPress={() => setStepsGoal(String(n))}
                      >
                        <Text
                          style={{
                            fontWeight: "700",
                            color:
                              stepsGoal === String(n)
                                ? colors.primary ?? "#fff"
                                : colors.text,
                          }}
                        >
                          {n.toLocaleString()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Field>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton title="←  Back" onPress={() => setStep(2)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title={loading ? "Creating..." : "Complete  ✓"}
                    onPress={complete}
                    loading={loading}
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
          <Text style={{ color: colors.text }}>
            Already have an account?{" "}
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              Sign in
            </Text>
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={{ alignItems: "center", marginTop: 8, marginBottom: 16 }}>
      <View style={styles.logoBox}>
        <Text style={styles.logoEmoji}>🏋️</Text>
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerSub}>{subtitle}</Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        {[1, 2, 3].map((n) => {
          const active = step >= (n as 1 | 2 | 3);
          return (
            <View
              key={n}
              style={[
                styles.stepDot,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? colors.primary ?? "#fff" : colors.text,
                  fontSize: 12,
                }}
              >
                {n}
              </Text>
            </View>
          );
        })}
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tempRef = useRef<Date | null>(null);

  if (Platform.OS === "android") {
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

  // iOS bottom sheet
  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.toolbar}>
          <Pressable onPress={onCancel}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.toolbarTitle}>Select Date of Birth</Text>
          <Pressable onPress={() => onConfirm(tempRef.current ?? initialDate)}>
            <Text style={styles.done}>Done</Text>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ marginBottom: 6, fontWeight: "700", color: colors.text }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function PrimaryButton({
  title,
  onPress,
  loading,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!!loading}
      style={[
        {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 4,
        },
        loading && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={{ color: colors.primary ?? "#fff", fontWeight: "700" }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

function SecondaryButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        marginTop: 4,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "700" }}>{title}</Text>
    </Pressable>
  );
}

/* ---------- themed styles ---------- */
const makeStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      backgroundColor: colors.card,
      color: colors.text,
    },
    pickerWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },

    // Header styles
    logoBox: {
      width: 64,
      height: 64,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    logoEmoji: { color: colors.onPrimary ?? "#fff", fontSize: 28 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
    headerSub: { color: colors.subtle, marginTop: 4, textAlign: "center" },

    stepDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },

    // DOB sheet (iOS)
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
    sheet: {
      backgroundColor: colors.card,
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
      borderBottomColor: colors.border,
    },
    toolbarTitle: { fontWeight: "700", color: colors.text },
    cancel: { color: colors.subtle, fontWeight: "600" },
    done: { color: colors.primaryText, fontWeight: "700" },
  });
