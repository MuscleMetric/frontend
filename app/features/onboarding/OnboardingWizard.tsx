import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../lib/useAppTheme";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/authContext";

import { PhonePreview } from "./previews/PhonePreview";
import { HomePreview } from "./previews/HomePreview";
import { ProgressPreview } from "./previews/ProgressPreview";
import { HistoryDetailPreview } from "./previews/HistoryDetailPreview";
import { WorkoutsPreview } from "./previews/WorkoutsPreview";
import { Step5StarterPreview } from "./previews/Step5StarterPreview";

type Split = "push" | "pull" | "legs";

type Props = {
  visible: boolean;
  onFinished?: () => void;
};

const MAX_STEP = 5;
const clampStep = (n: number) =>
  Math.max(1, Math.min(MAX_STEP, Math.floor(n || 1)));

export function OnboardingWizard({ visible, onFinished }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { profile } = useAuth();

  // 1 home -> 2 progress -> 3 history detail -> 4 workouts -> 5 start workout
  const [step, setStep] = useState<number>(1);

  const [split, setSplit] = useState<Split>("push");
  const [creating, setCreating] = useState(false);

  const [createdWorkout, setCreatedWorkout] = useState<{
    workout_id: string;
    title: string;
    split: string;
  } | null>(null);

  // ✅ Resume onboarding step when opened (instead of always resetting to step 1)
  useEffect(() => {
    if (!visible) return;

    // if already completed, don't show (defensive)
    if (profile?.onboarding_completed_at) return;

    const resumeStep = clampStep(profile?.onboarding_step ?? 1);
    setStep(resumeStep);

    // keep these fresh each run
    setSplit("push");
    setCreating(false);
    setCreatedWorkout(null);
  }, [visible, profile?.onboarding_completed_at, profile?.onboarding_step]);

  const setOnboardingStep = useCallback(
    async (nextStep: number) => {
      try {
        if (!profile?.id) return;
        await supabase
          .from("profiles")
          .update({ onboarding_step: clampStep(nextStep) })
          .eq("id", profile.id);
      } catch {}
    },
    [profile?.id]
  );

  const markCompleted = useCallback(async () => {
    try {
      if (!profile?.id) return;
      await supabase
        .from("profiles")
        .update({
          onboarding_step: MAX_STEP,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
    } catch {}
  }, [profile?.id]);

  const next = useCallback(async () => {
    const nextStep = clampStep(step + 1);
    setStep(nextStep);
    await setOnboardingStep(nextStep);
  }, [setOnboardingStep, step]);

  const back = useCallback(async () => {
    const prev = clampStep(step - 1);
    setStep(prev);
    await setOnboardingStep(prev);
  }, [setOnboardingStep, step]);

  // ✅ make createStarter RETURN the created workout_id so Step 5 can navigate reliably
  const createStarter = useCallback(async (): Promise<string | null> => {
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_starter_workout", {
        p_split: split,
      });
      if (error) throw error;

      const payload = data as any;
      const workoutId = payload?.workout_id ? String(payload.workout_id) : null;

      if (workoutId) {
        setCreatedWorkout({
          workout_id: workoutId,
          title: String(payload.title ?? "Starter Workout"),
          split: String(payload.split ?? split),
        });
      }

      return workoutId;
    } catch (e: any) {
      console.warn("create_starter_workout failed:", e?.message ?? e);
      return null;
    } finally {
      setCreating(false);
    }
  }, [split]);

  const startWorkoutFlow = useCallback(async () => {
    // if they didn’t create it yet, create now and use the returned id
    const workoutId = createdWorkout?.workout_id ?? (await createStarter());

    if (!workoutId) return;

    await markCompleted();
    onFinished?.();

    router.push({
      pathname: "/features/workouts/use",
      params: { workoutId },
    });
  }, [createdWorkout?.workout_id, createStarter, markCompleted, onFinished]);

  const finishWithoutStarter = useCallback(async () => {
    await markCompleted();
    onFinished?.();
    router.push("/(tabs)/workout");
  }, [markCompleted, onFinished]);

  const stepTitle = useMemo(() => {
    switch (step) {
      case 1:
        return "This is your Home screen";
      case 2:
        return "Track progress automatically";
      case 3:
        return "Every workout is remembered";
      case 4:
        return "Structure your training";
      case 5:
        return "Let’s get you started";
      default:
        return "Getting started";
    }
  }, [step]);

  const stepSub = useMemo(() => {
    switch (step) {
      case 1:
        return "Your goals, PRs, streaks, and next workout — in one place.";
      case 2:
        return "Logged sets become trends, PRs, and progress charts.";
      case 3:
        return "Open any workout and review sets, volume, and notes.";
      case 4:
        return "Build workouts once and reuse them, or follow a plan.";
      case 5:
        return "Pick a starter split or jump straight into custom workouts.";
      default:
        return "";
    }
  }, [step]);

  const Preview = useMemo(() => {
    if (step === 1) return <HomePreview />;
    if (step === 2) return <ProgressPreview />;
    if (step === 3) return <HistoryDetailPreview />;
    if (step === 4) return <WorkoutsPreview />;

    return <Step5StarterPreview split={split} setSplit={setSplit} />;
  }, [step, split]);

  if (!visible) return null;
  if (profile?.onboarding_completed_at) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Onboarding • Step {step} / 5</Text>
            <Text style={styles.title}>{stepTitle}</Text>
            <Text style={styles.subtitle}>{stepSub}</Text>
          </View>

          {/* ✅ smaller preview so your header copy is clearer */}
          <PhonePreview height={560}>{Preview}</PhonePreview>

          <View style={styles.footer}>
            {step < 5 ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  style={[styles.btn, styles.btnGhost, { flex: 1 }]}
                  onPress={back}
                  disabled={step === 1}
                >
                  <Text style={styles.btnGhostText}>Back</Text>
                </Pressable>

                <Pressable
                  style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
                  onPress={next}
                >
                  <Text style={styles.btnPrimaryText}>Next</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {/* Primary on top */}
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={startWorkoutFlow}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator />
                  ) : (
                    <Text style={styles.btnPrimaryText}>
                      Create & Start Workout
                    </Text>
                  )}
                </Pressable>

                {/* Secondary row: custom + back */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    style={[styles.btn, styles.btnGhost, { flex: 1 }]}
                    onPress={back}
                    disabled={creating}
                  >
                    <Text style={styles.btnGhostText}>Back</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.btn, styles.btnGhost, { flex: 1}]}
                    onPress={finishWithoutStarter}
                    disabled={creating}
                  >
                    <Text style={styles.btnGhostText}>
                      Create Custom Workout
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: 16,
      paddingBottom: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 12,
    },

    header: { gap: 6 },
    kicker: { color: colors.subtle, fontWeight: "900" },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.6,
    },
    subtitle: { color: colors.subtle, fontWeight: "700" },

    footer: { paddingTop: 2 },

    btn: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimary: { backgroundColor: colors.primary },
    btnPrimaryText: { color: "white", fontWeight: "900" },
    btnGhost: {
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnGhostText: { color: colors.text, fontWeight: "900" },

    splitPillTap: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    splitPillActive: {
      borderColor: "rgba(14,165,233,0.55)",
      backgroundColor: "rgba(14,165,233,0.14)",
    },
    splitPillText: { color: colors.text, fontWeight: "900" },

    noteCard: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 14,
      gap: 6,
    },
    noteTitle: { color: colors.text, fontWeight: "900" },
    noteLine: { color: colors.subtle, fontWeight: "700" },

    readyCard: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(14,165,233,0.35)",
      backgroundColor: "rgba(14,165,233,0.12)",
      padding: 14,
      gap: 6,
    },
    readyTitle: { color: colors.text, fontWeight: "900" },
    readySub: { color: colors.subtle, fontWeight: "800" },
  });
