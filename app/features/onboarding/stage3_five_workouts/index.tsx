// app/onboarding/stage3_five_workouts/index.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";

import { useStage3Data } from "./hooks/useStage3Data";
import type { Stage3UiStrings } from "./types";

import { OnboardingHeader } from "./components/OnboardingHeader";
import { PaginationDots } from "./components/PaginationDots";
import { StageFooterCTA } from "./components/StageFooterCTA";

import MilestoneUnlocked from "./screens/MilestoneUnlocked";
import InsightsOverview from "./screens/InsightsOverview";
import ProgressTrends from "./screens/ProgressTrends";
import ConsistencyStreak from "./screens/ConsistencyStreak";
import PlanAdoption from "./screens/PlanAdoption";
import { supabase } from "@/lib/supabase";

type Step = 0 | 1 | 2 | 3 | 4;
const TOTAL_STEPS = 5;

function stepTitle(step: Step) {
  switch (step) {
    case 0:
      return "Milestone unlocked";
    case 1:
      return "What your workouts reveal";
    case 2:
      return "Progress trends";
    case 3:
      return "Consistency";
    case 4:
      return "Next: reach goals faster";
  }
}

function stepSubtitle(step: Step, ui: Stage3UiStrings) {
  switch (step) {
    case 0:
      return `You’ve logged ${ui.workoutsTotalLabel} workouts ${ui.windowLabel}. Here’s what we can now show you.`;
    case 1:
      return "We turn your logged sets into insights you can actually use.";
    case 2:
      return `${ui.spotlightTitle} is trending. This is the kind of progress tracking you’ll unlock.`;
    case 3:
      return `You’re ${ui.weeklyProgressLabel} this week — small consistency = big results.`;
    case 4:
      return "Plans make progress automatic: structure, targets, and clarity every session.";
  }
}

function primaryTitle(step: Step) {
  return step === 4 ? "Create a plan" : "Continue";
}

export default function Stage3FiveWorkoutsIndex() {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const { loading, error, ui, payload } = useStage3Data();
  const [step, setStep] = useState<Step>(0);

  function next() {
    setStep((s) => Math.min(4, (s + 1) as Step) as Step);
  }

  function back() {
    setStep((s) => Math.max(0, (s - 1) as Step) as Step);
  }

  async function finish() {
    try {
      const { error } = await supabase.rpc("complete_onboarding_stage3");

      if (error) {
        console.error("[stage3] complete error:", error);
      } else {
        console.log("[stage3] marked complete");
      }
    } catch (e) {
      console.error("[stage3] unexpected error:", e);
    }

    router.replace("/(tabs)/workout");
  }

  function onPrimary() {
    if (step === 4) finish();
    else next();
  }

  if (loading) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !ui) {
    return (
      <View style={[styles.page, styles.center]}>
        <Text style={styles.errorTitle}>Couldn’t load your insights</Text>
        <Text style={styles.errorSub}>{error ?? "Unknown error"}</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <OnboardingHeader
        stepLabel={`${step + 1} of ${TOTAL_STEPS}`}
        onBack={step > 0 ? back : null}
      />

      <View style={styles.content}>
        {step === 0 ? (
          <MilestoneUnlocked ui={ui} payload={payload} />
        ) : step === 1 ? (
          <InsightsOverview ui={ui} payload={payload} />
        ) : step === 2 ? (
          <ProgressTrends ui={ui} payload={payload} />
        ) : step === 3 ? (
          <ConsistencyStreak ui={ui} payload={payload} />
        ) : (
          <PlanAdoption ui={ui} payload={payload} />
        )}
      </View>

      <StageFooterCTA
        primaryTitle={primaryTitle(step)}
        onPrimary={onPrimary}
        onSecondary={step > 0 ? back : null}
        topSlot={<PaginationDots total={TOTAL_STEPS} activeIndex={step} />}
      />
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: layout.space.lg,
    },

    content: {
      flex: 1,
      paddingHorizontal: layout.space.lg,
      paddingBottom: layout.space.md,
    },

    errorTitle: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h1,
      textAlign: "center",
    },
    errorSub: {
      marginTop: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      textAlign: "center",
    },
  });
