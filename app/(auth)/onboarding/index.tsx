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

  function onChange<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((p) => ({ ...p, [key]: value }));
    // clear related error as user interacts
    setErrors((e) => {
      const next = { ...e };
      if (key === "fullName") delete next.fullName;
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

  function next() {
    const map = validateStep(draft, step);
    setErrors(map);
    if (hasErrors(map)) return;
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

      const u = session.user;
      const meta = (u.user_metadata || {}) as any;

      const trimmedName =
        draft.fullName.trim() ||
        meta.name ||
        meta.full_name ||
        meta.given_name ||
        u.email ||
        null;

      const trimmedEmail = (draft.email || u.email || meta.email || "").trim() || null;

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
      };

      const { error } = await supabase.from("profiles").upsert(profilePayload);
      if (error) throw error;

      setStep(4); // Ready screen
    } catch (e: any) {
      console.warn("Onboarding save failed:", e);
      Alert.alert("Onboarding failed", e?.message ?? "Failed to save profile. Try again.");
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
