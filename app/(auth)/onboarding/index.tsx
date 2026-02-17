import React, { useEffect, useMemo, useState } from "react";
import { View, Alert, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../lib/useAppTheme";
import { useAuth } from "../../../lib/authContext";
import { supabase } from "../../../lib/supabase";
import { toISODateUTC } from "../../utils/dates";

import type { ErrorMap, OnboardingDraft } from "./types";
import { validateStep, hasErrors } from "./schema";

import { TopBar } from "./components/TopBar";
import { DobSheet } from "./components/DobSheet";

import { AboutYouStep } from "./steps/AboutYouStep";
import { BodyMetricsStep } from "./steps/BodyMetricsStep";
import { TrainingProfileStep } from "./steps/TrainingProfileStep";
import { ConsistencyStep } from "./steps/ConsistencyStep";
import { ReadyStep } from "./steps/ReadyStep";

const DEFAULT_DRAFT: OnboardingDraft = {
  fullName: "",
  username: "",
  email: "",
  dob: null,
  gender: null,

  // give defaults so the screen isn’t “stuck” before you add sliders
  heightCm: 175,
  weightKg: 70,
  unitHeight: "cm",
  unitWeight: "kg",

  level: "beginner",
  primaryGoal: "build_muscle",

  workoutsPerWeek: 3,
  stepsGoal: 10000,
};

export default function OnboardingIndex() {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { session, loading: authLoading } = useAuth();

  // step: 0..3 = setup, 4 = ready
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [draft, setDraft] = useState<OnboardingDraft>(DEFAULT_DRAFT);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [saving, setSaving] = useState(false);

  const [showDob, setShowDob] = useState(false);

  // Guard
  useEffect(() => {
    if (!authLoading && !session) {
      Alert.alert("Not signed in", "Please log in again.");
      router.replace("/(auth)/login");
    }
  }, [authLoading, session]);

  // Prefill name/email from provider metadata
  useEffect(() => {
    if (!session) return;
    const u = session.user;
    const meta = (u.user_metadata || {}) as any;

    setDraft((prev) => ({
      ...prev,
      email: prev.email || u.email || meta.email || "",
      fullName:
        prev.fullName ||
        meta.name ||
        meta.full_name ||
        meta.given_name ||
        meta.preferred_username ||
        "",
    }));
  }, [session]);

  async function ensureUsernameOk(): Promise<true | string> {
    const raw = (draft.username ?? "").trim();

    // Let your schema catch empty, but we can short-circuit too
    if (!raw) return "Add a username";

    const res = await supabase
      .rpc("check_username_available_v1", { p_username: raw })
      .single();

    if (res.error) {
      return res.error.message ?? "Failed to check username";
    }

    const row = res.data as any;
    // row: normalized, is_valid, is_available, reason

    if (!row?.is_valid) {
      // map their reason to a nice message
      if (row.reason === "too_short")
        return "Username must be at least 3 characters";
      if (row.reason === "too_long")
        return "Username must be 13 characters or less";
      if (row.reason === "no_spaces") return "Username can’t contain spaces";
      if (row.reason === "invalid_chars")
        return "Only letters, numbers, and underscores";
      return "Invalid username";
    }

    if (!row?.is_available) {
      return "That username is taken";
    }

    // optional: normalize draft to canonical normalized value
    // This keeps draft consistent with DB logic
    if (row.normalized && row.normalized !== draft.username) {
      setDraft((p) => ({ ...p, username: row.normalized }));
    }

    return true;
  }

  function onChange<K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K]
  ) {
    setDraft((p) => ({ ...p, [key]: value }));
    // clear related error as user interacts
    setErrors((e) => {
      const next = { ...e };
      if (key === "fullName") delete next.fullName;
      if (key === "username") delete (next as any).username;
      if (key === "dob") delete next.dob;
      if (key === "gender") delete next.gender;
      if (key === "heightCm") delete next.height;
      if (key === "weightKg") delete next.weight;
      if (key === "workoutsPerWeek") delete next.workoutsPerWeek;
      if (key === "stepsGoal") delete next.stepsGoal;
      return next;
    });
  }

  function back() {
    if (step === 0) {
      router.back();
      return;
    }
    if (step === 4) {
      // if user is on ready screen, don't go back into form
      router.replace("/(tabs)");
      return;
    }
    setErrors({});
    setStep((s) => (s - 1) as any);
  }

  async function next() {
    const map = validateStep(draft, step);
    setErrors(map);
    if (hasErrors(map)) return;

    // ✅ extra gate only on Step 0
    if (step === 0) {
      const ok = await ensureUsernameOk();
      if (ok !== true) {
        setErrors((e) => ({ ...(e as any), username: ok }));
        return;
      }
    }

    setStep((s) => (s + 1) as any);
  }

  async function finish() {
    const map = validateStep(draft, 3);
    setErrors(map);
    if (hasErrors(map)) return;

    if (!session) {
      Alert.alert("No account connected", "Please sign in again.");
      router.replace("/(auth)/login");
      return;
    }

    try {
      setSaving(true);

      // ✅ Save username through your canonical RPC
      const uRes = await supabase
        .rpc("set_username_v1", { p_username: draft.username })
        .single();

      if (uRes.error) throw uRes.error;

      const u = session.user;
      const meta = (u.user_metadata || {}) as any;

      const trimmedName =
        draft.fullName.trim() ||
        meta.name ||
        meta.full_name ||
        meta.given_name ||
        u.email ||
        null;

      const trimmedEmail =
        (draft.email || u.email || meta.email || "").trim() || null;

      const profilePayload: any = {
        id: u.id,
        name: trimmedName,
        email: trimmedEmail,
        height: draft.heightCm,
        weight: draft.weightKg,
        date_of_birth: draft.dob ? toISODateUTC(draft.dob) : null,
        steps_goal: Math.max(0, Number(draft.stepsGoal) || 0),
        weekly_workout_goal: draft.workoutsPerWeek,
        settings: {
          gender: draft.gender,
          level: draft.level,
          primaryGoal: draft.primaryGoal,
          workoutsPerWeek: draft.workoutsPerWeek,
          unit_weight: draft.unitWeight,
          unit_height: draft.unitHeight,
        },
        onboarding_step: 1,
        onboarding_completed_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(profilePayload);
      if (error) throw error;

      setStep(4); // Ready screen
    } catch (e: any) {
      
      const msg = String(e?.message ?? "");
      if (msg.includes("username_")) {
        const m: any = {};
        if (msg.includes("username_too_short"))
          m.username = "Username must be at least 3 characters";
        else if (msg.includes("username_too_long"))
          m.username = "Username must be 13 characters or less";
        else if (msg.includes("username_no_spaces"))
          m.username = "Username can’t contain spaces";
        else if (msg.includes("username_invalid_chars"))
          m.username = "Only letters, numbers, and underscores";
        else if (msg.includes("username_taken"))
          m.username = "That username is taken";
        else m.username = "Invalid username";
        setErrors((prev) => ({ ...(prev as any), ...m }));
        setStep(0); // bounce them back to step 0 where the field is
        setSaving(false);
        return;
      }

      console.warn("Onboarding save failed:", e);
      Alert.alert(
        "Onboarding failed",
        e?.message ?? "Failed to save profile. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function start() {
    router.replace("/(tabs)");
  }

  if (authLoading) {
    return <View style={styles.loading} />;
  }

  // Avoid TS issues if your component signatures differ slightly
  const TopBarAny = TopBar as any;
  const DobSheetAny = DobSheet as any;

  return (
    <View style={styles.page}>
      <TopBarAny
        title="Setup"
        onBack={back}
        // if your TopBar supports it, great; otherwise harmless
        showBack
      />

      <View style={styles.content}>
        {step === 0 && (
          <AboutYouStep
            draft={draft}
            errors={errors}
            onChange={onChange}
            onOpenDob={() => setShowDob(true)}
            onNext={next}
            stepLabel="STEP 1 OF 4"
            progress={0.25}
          />
        )}

        {step === 1 && (
          <BodyMetricsStep
            draft={draft}
            errors={errors}
            onChange={onChange}
            onNext={next}
            stepLabel="STEP 2 OF 4"
            progress={0.5}
          />
        )}

        {step === 2 && (
          <TrainingProfileStep
            draft={draft}
            onChange={onChange}
            onNext={next}
            stepLabel="STEP 3 OF 4"
            rightLabel="75% Complete"
            progress={0.75}
          />
        )}

        {step === 3 && (
          <ConsistencyStep
            draft={draft}
            errors={errors}
            onChange={onChange}
            onFinish={finish}
            loading={saving}
            stepLabel="STEP 4 OF 4"
            rightLabel="100%"
            progress={1}
          />
        )}

        {step === 4 && <ReadyStep onStart={start} />}
      </View>

      {/* DOB sheet controlled here so step stays clean */}
      {showDob &&
        (Platform.OS === "ios" ? (
          <DobSheetAny
            initialDate={draft.dob ?? new Date(2000, 0, 1)}
            onCancel={() => setShowDob(false)}
            onConfirm={(d: Date) => {
              onChange("dob", d);
              setShowDob(false);
            }}
          />
        ) : (
          // If your DobSheet supports Android too, keep it.
          // Otherwise you can swap for DateTimePicker in Android later.
          <DobSheetAny
            initialDate={draft.dob ?? new Date(2000, 0, 1)}
            onCancel={() => setShowDob(false)}
            onConfirm={(d: Date) => {
              onChange("dob", d);
              setShowDob(false);
            }}
          />
        ))}
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    loading: { flex: 1, backgroundColor: colors.background },
  });
