// app/(auth)/signup.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAppTheme } from "../../lib/useAppTheme";
import { toISODateUTC } from "../utils/dates";
import { useAuth } from "../../lib/useAuth";

type Level = "beginner" | "intermediate" | "advanced";
type Goal = "build_muscle" | "lose_fat" | "get_stronger" | "improve_endurance";
type Gender = "male" | "female" | "other";

// realistic bounds
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;

export default function Signup() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { session } = useAuth(); // ⬅️ session from Google / Apple

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(""); // just for profile, NOT for auth

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

  // Prefill name/email from provider metadata when we get a session
  useEffect(() => {
    if (!session) return;
    const u = session.user;
    const meta = (u.user_metadata || {}) as any;

    if (!email) {
      setEmail(u.email ?? meta.email ?? "");
    }

    if (!fullName) {
      const metaName =
        meta.name ?? meta.full_name ?? meta.given_name ?? meta.preferred_username;
      if (metaName) setFullName(metaName);
    }
  }, [session]);

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

  // Step 1: they MUST have connected Google/Apple and given a name
  function validateStep1(): boolean {
    const name = fullName.trim();
    if (!session) {
      Alert.alert(
        "Connect your account",
        "Please continue with Google or Apple first."
      );
      return false;
    }
    if (!name) {
      Alert.alert("Add your name", "Please enter your full name.");
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (!dob || !gender || !height || !weight) {
      Alert.alert(
        "Almost there",
        "Please select your date of birth, gender, height, and weight."
      );
      return false;
    }

    const ageVal = calcAge(dob);
    if (ageVal != null && ageVal < 13) {
      Alert.alert(
        "Too young",
        "You must be at least 13 years old to use this app."
      );
      return false;
    }

    const h = Number(height);
    const w = Number(weight);

    if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) {
      Alert.alert(
        "Check your details",
        "Height and weight must be positive numbers."
      );
      return false;
    }

    if (h < MIN_HEIGHT_CM || h > MAX_HEIGHT_CM) {
      Alert.alert(
        "Check your height",
        `Please enter a height between ${MIN_HEIGHT_CM}cm and ${MAX_HEIGHT_CM}cm.`
      );
      return false;
    }

    if (w < MIN_WEIGHT_KG || w > MAX_WEIGHT_KG) {
      Alert.alert(
        "Check your weight",
        `Please enter a weight between ${MIN_WEIGHT_KG}kg and ${MAX_WEIGHT_KG}kg.`
      );
      return false;
    }

    return true;
  }

  function next() {
    Keyboard.dismiss();

    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
    }
  }

  // Start Google / Apple OAuth
  async function signInWithProvider(provider: "google" | "apple") {
    try {
      setLoading(true);

      // expo-router deep link back into the app – adjust path if needed
      const redirectTo = Linking.createURL("/callback");

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) throw error;

      // After this, browser opens → user signs in → Supabase stores session.
      // useAuth() should pick up the new session automatically.
    } catch (e: any) {
      console.warn("OAuth sign-in failed:", e);
      Alert.alert(
        "Sign in failed",
        e?.message ?? "Could not sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function complete() {
    Keyboard.dismiss();

    if (!validateStep1() || !validateStep2()) return;

    if (!session) {
      Alert.alert(
        "No account connected",
        "Please connect Google or Apple again."
      );
      return;
    }

    try {
      setLoading(true);

      const u = session.user;
      const meta = (u.user_metadata || {}) as any;

      const trimmedName =
        fullName.trim() ||
        meta.name ||
        meta.full_name ||
        meta.given_name ||
        u.email ||
        null;

      const trimmedEmail =
        email.trim() || u.email || (meta.email as string | undefined) || null;

      const userId = u.id;

      const profilePayload: any = {
        id: userId,
        name: trimmedName,
        email: trimmedEmail,
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        date_of_birth: dob ? toISODateUTC(dob) : null,
        steps_goal: Math.max(0, Number(stepsGoal) || 0),
        weekly_workout_goal: workoutsPerWeek,
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

      router.replace("/(tabs)");
    } catch (e: any) {
      console.warn("Profile completion failed:", e);
      const msg =
        e?.message ??
        "Something went wrong while creating your account. Please try again.";
      Alert.alert("Sign up failed", msg);
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
        contentContainerStyle={styles.fullScroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centerWrap}>
          <Header
            title="Create Account"
            subtitle={
              step === 1
                ? "Sign up with Google or Apple to get started"
                : step === 2
                ? "Tell us a bit about yourself"
                : "Set up your goals so we can guide you"
            }
            step={step}
          />

          {/* CARD */}
          <View style={styles.card}>
            {step === 1 && (
              <>
                <PrimaryButton
                  title="Continue with Google"
                  onPress={() => signInWithProvider("google")}
                  loading={loading}
                />
                <SecondaryButton
                  title="Continue with Apple"
                  onPress={() => signInWithProvider("apple")}
                />

                <View style={{ height: 16 }} />

                <Field label="Connected account">
                  <Text style={{ color: colors.text }}>
                    {session
                      ? session.user.email ??
                        ((session.user.user_metadata || {}) as any).email ??
                        "Connected"
                      : "Not connected yet"}
                  </Text>
                </Field>

                <Field label="Full Name">
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={colors.subtle}
                    value={fullName}
                    onChangeText={setFullName}
                    returnKeyType="next"
                  />
                  <Text style={styles.helper}>
                    We’ll use this for your profile and greetings.
                  </Text>
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
                    <Text
                      style={{
                        color: dob ? colors.text : colors.subtle,
                      }}
                    >
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
                              color: active ? "#fff" : colors.text,
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
                  <Text style={styles.helper}>
                    {MIN_HEIGHT_CM}–{MAX_HEIGHT_CM} cm
                  </Text>
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
                  <Text style={styles.helper}>
                    {MIN_WEIGHT_KG}–{MAX_WEIGHT_KG} kg
                  </Text>
                </Field>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton
                      title="←  Back"
                      onPress={() => setStep(1)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Next  →" onPress={next} />
                  </View>
                </View>
              </>
            )}

            {step === 3 && (
              <>
                {/* Level – card options instead of wheel picker */}
                <Field label="Current Fitness Level">
                  <View style={styles.optionList}>
                    {(
                      [
                        {
                          value: "beginner" as Level,
                          label: "Beginner",
                          desc: "New to training or back after a break",
                        },
                        {
                          value: "intermediate" as Level,
                          label: "Intermediate",
                          desc: "Training consistently 6–24 months",
                        },
                        {
                          value: "advanced" as Level,
                          label: "Advanced",
                          desc: "Training hard for 2+ years",
                        },
                      ] as const
                    ).map((opt) => {
                      const active = level === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setLevel(opt.value)}
                          style={[
                            styles.optionCard,
                            active && styles.optionCardActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionTitle,
                              active && styles.optionTitleActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            style={[
                              styles.optionDesc,
                              active && styles.optionDescActive,
                            ]}
                          >
                            {opt.desc}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                {/* Primary goal – card options */}
                <Field label="Primary Fitness Goal">
                  <View style={styles.optionList}>
                    {(
                      [
                        {
                          value: "build_muscle" as Goal,
                          label: "Build Muscle",
                          desc: "Add size and shape to your physique",
                        },
                        {
                          value: "lose_fat" as Goal,
                          label: "Lose Fat",
                          desc: "Reduce body fat and look leaner",
                        },
                        {
                          value: "get_stronger" as Goal,
                          label: "Get Stronger",
                          desc: "Focus on performance and heavy lifts",
                        },
                        {
                          value: "improve_endurance" as Goal,
                          label: "Improve Endurance",
                          desc: "Improve fitness for sport or life",
                        },
                      ] as const
                    ).map((opt) => {
                      const active = primaryGoal === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setPrimaryGoal(opt.value)}
                          style={[
                            styles.optionCard,
                            active && styles.optionCardActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionTitle,
                              active && styles.optionTitleActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            style={[
                              styles.optionDesc,
                              active && styles.optionDescActive,
                            ]}
                          >
                            {opt.desc}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                {/* Workouts per week – small set of options */}
                <Field label="Workouts Per Week">
                  <View style={{ gap: 8 }}>
                    {/* Row 1: 1–3 */}
                    <View style={styles.optionRow}>
                      {[1, 2, 3].map((n) => {
                        const active = workoutsPerWeek === n;
                        return (
                          <Pressable
                            key={n}
                            onPress={() => setWorkoutsPerWeek(n)}
                            style={[
                              styles.smallOption,
                              active && styles.smallOptionActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.smallOptionText,
                                active && styles.smallOptionTextActive,
                              ]}
                            >
                              {n} workout{n > 1 ? "s" : ""}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Row 2: 4–5 */}
                    <View style={styles.optionRow}>
                      {[4, 5].map((n) => {
                        const active = workoutsPerWeek === n;
                        return (
                          <Pressable
                            key={n}
                            onPress={() => setWorkoutsPerWeek(n)}
                            style={[
                              styles.smallOption,
                              active && styles.smallOptionActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.smallOptionText,
                                active && styles.smallOptionTextActive,
                              ]}
                            >
                              {n} workouts
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Row 3: 6–7 */}
                    <View style={styles.optionRow}>
                      {[6, 7].map((n) => {
                        const active = workoutsPerWeek === n;
                        return (
                          <Pressable
                            key={n}
                            onPress={() => setWorkoutsPerWeek(n)}
                            style={[
                              styles.smallOption,
                              active && styles.smallOptionActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.smallOptionText,
                                active && styles.smallOptionTextActive,
                              ]}
                            >
                              {n} workouts
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </Field>

                {/* Steps goal */}
                <Field label="Daily Steps Goal">
                  <View style={{ gap: 8 }}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 10,000"
                      placeholderTextColor={colors.subtle}
                      keyboardType="number-pad"
                      value={stepsGoal}
                      onChangeText={setStepsGoal}
                    />

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[8000, 10000, 12000].map((n) => {
                        const match = stepsGoal === String(n);
                        return (
                          <Pressable
                            key={n}
                            style={[
                              styles.chip,
                              match && {
                                backgroundColor: colors.primary,
                                borderColor: colors.primary,
                              },
                            ]}
                            onPress={() => setStepsGoal(String(n))}
                          >
                            <Text
                              style={{
                                fontWeight: "700",
                                color: match ? "#fff" : colors.text,
                              }}
                            >
                              {n.toLocaleString()}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </Field>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton
                      title="←  Back"
                      onPress={() => setStep(2)}
                    />
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
        </View>
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

      {/* Full-screen loading overlay while creating account */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text
              style={{
                marginTop: 8,
                color: colors.text,
                fontWeight: "600",
              }}
            >
              Creating your account…
            </Text>
          </View>
        </View>
      )}
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
    <View style={{ alignItems: "center", marginBottom: 16 }}>
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
                  color: active ? "#fff" : colors.text,
                  fontSize: 12,
                  fontWeight: "700",
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
        <Text style={{ color: "#fff", fontWeight: "700" }}>{title}</Text>
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
    fullScroll: {
      flexGrow: 1,
    },
    centerWrap: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 24,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      width: "100%",
      maxWidth: 420,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      backgroundColor: colors.card,
      color: colors.text,
    },
    helper: {
      marginTop: 4,
      fontSize: 12,
      color: colors.subtle,
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

    // option cards (step 3)
    optionList: {
      gap: 8,
    },
    optionCard: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionCardActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionTitle: {
      fontWeight: "700",
      fontSize: 16,
      color: colors.text,
    },
    optionTitleActive: {
      color: "#fff",
    },
    optionDesc: {
      marginTop: 2,
      fontSize: 13,
      color: colors.subtle,
    },
    optionDescActive: {
      color: "#f3f4f6",
    },

    optionRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },

    smallOption: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    smallOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    smallOptionText: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 14,
    },

    smallOptionTextActive: {
      color: "#fff",
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
    logoEmoji: { color: "#fff", fontSize: 28 },
    headerTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
    headerSub: {
      color: colors.subtle,
      marginTop: 4,
      textAlign: "center",
      fontSize: 14,
    },

    stepDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
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

    // loading overlay
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.3)",
      alignItems: "center",
      justifyContent: "center",
    },
    loadingCard: {
      backgroundColor: colors.card,
      padding: 20,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 200,
    },
  });
