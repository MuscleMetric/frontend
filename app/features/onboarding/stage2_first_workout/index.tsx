// app/onboarding/stage2/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/ui/icons/Icon";

import { PrimaryCTA } from "../shared/components/PrimaryCTA";
import { markOnboardingStageComplete } from "../shared/rpc";
import WorkoutSaved from "./WorkoutSavedScreen";
import RememberSetsScreen from "./RememberSetsScreen";
import UnlockInsightsScreen from "./UnlockInsightsScreen";
import RememberSets from "./RememberSetsScreen";

/**
 * Stage 2: after exactly 1 workout (gated by get_onboarding_gate_v1)
 * Uses RPC: public.get_onboarding_stage2_payload_v1()
 *
 * Flow:
 *  1) Workout saved summary
 *  2) We'll remember your sets (autofill preview)
 *  3) Unlocking insights + "Start next workout"
 */

type Step = 0 | 1 | 2;

type Stage2Payload = {
  workout_history_id: string;
  workout_id: string | null;
  workout_title: string | null;
  workout_image_key: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  sets_logged: number | null;
  total_volume_kg: number | null;

  preview_exercise_id: string | null;
  preview_exercise_name: string | null;
  preview_sets: number | null;
  preview_reps: number | null;
  preview_weight: number | null;

  workouts_completed: number | null;
  unit_weight: "kg" | "lb" | string | null;
};

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatInt(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return String(Math.round(n));
}

function formatWeight(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  // keep clean; change to 1dp if you store fractional kg
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

export default function Stage2Onboarding() {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);

  const [fetching, setFetching] = useState(true);
  const [payload, setPayload] = useState<Stage2Payload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setFetching(true);

        const res = await supabase
          .rpc("get_last_workout_onboarding_payload_v1")
          .single();

        if (cancelled) return;

        if (res.error || !res.data) {
          console.warn("stage2 payload rpc error:", res.error);
          setPayload(null);
          setFetching(false);
          return;
        }

        setPayload(res.data as Stage2Payload);
        setFetching(false);
      } catch (e) {
        if (!cancelled) {
          console.warn("stage2 payload load failed:", e);
          setPayload(null);
          setFetching(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function finishStage2AndGoWorkouts() {
    try {
      setLoading(true);
      await markOnboardingStageComplete("stage2");
    } catch (e) {
      // Gate will keep forcing stage2 if not marked complete
      console.warn("mark stage2 failed:", e);
    } finally {
      setLoading(false);
      router.replace("/(tabs)/workout");
    }
  }

  function next() {
    setStep((s) => Math.min(2, s + 1) as Step);
  }

  // Minimal fallback so you never render blank UI
  const workoutTitle = payload?.workout_title ?? "Workout";
  const unitWeight = payload?.unit_weight ?? "kg";

  if (fetching) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        {/* Brand */}
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>MUSCLEMETRIC</Text>
        </View>

        {step === 0 ? (
          <WorkoutSaved
            workoutTitle={workoutTitle}
            workoutImageKey={payload?.workout_image_key ?? null}
            durationLabel={formatDuration(payload?.duration_seconds ?? null)}
            setsLabel={formatInt(payload?.sets_logged ?? null)}
            volumeLabel={formatInt(payload?.total_volume_kg ?? null)}
            volumeUnit={unitWeight ?? "kg"}
            imageUri={null}
            onPrimary={next}
          />
        ) : step === 1 ? (
          <RememberSets
            unitWeight={payload?.unit_weight ?? "kg"}
            trackedSets={(payload as any)?.tracked_sets ?? []}
            workoutTitle={workoutTitle}
            onPrimary={next}
          />
        ) : (
          <UnlockInsightsScreen
            styles={styles}
            workoutsCompleted={payload?.workouts_completed ?? 1}
            onPrimary={finishStage2AndGoWorkouts}
            loading={loading}
          />
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: any) => {
  const success = colors.success ?? "#22C55E";
  const primary = colors.primary ?? "#2563EB";

  const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg ?? colors.background },
    body: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },

    brandRow: { alignItems: "center", marginBottom: 8 },
    brandText: {
      color: primary,
      fontWeight: "900",
      letterSpacing: 1.4,
      fontSize: 12,
    },

    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    pillRow: { alignItems: "center", marginTop: 10, marginBottom: 12 },
    savedPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(34,197,94,0.14)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(34,197,94,0.35)",
    },
    savedPillText: { color: success, fontWeight: "900" },

    heroTitle: {
      color: colors.text,
      fontSize: 38,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: 8,
    },
    heroTitle2: {
      color: colors.text,
      fontSize: 38,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: 18,
      marginBottom: 18,
    },
    heroTitle3: {
      color: colors.text,
      fontSize: 38,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: 10,
    },
    heroSub: {
      color: colors.textMuted ?? colors.subtle,
      marginTop: 10,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      maxWidth: 360,
      marginBottom: 18,
    },

    bigCard: {
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
      marginTop: 10,
      marginBottom: 16,
      padding: 18,
    },

    baselineKicker: {
      color: primary,
      fontWeight: "900",
      letterSpacing: 1.2,
      fontSize: 12,
      marginBottom: 8,
    },
    workoutName: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 26,
      marginBottom: 14,
    },

    bigCardStatsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    statBlock: { flex: 1 },
    statLabel: {
      color: "rgba(255,255,255,0.45)",
      fontWeight: "900",
      letterSpacing: 1.1,
      fontSize: 11,
      marginBottom: 8,
    },
    statValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    statValue: { color: colors.text, fontWeight: "900", fontSize: 22 },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(255,255,255,0.10)",
      marginTop: 14,
      marginBottom: 14,
    },

    totalLabel: {
      textAlign: "center",
      color: "rgba(255,255,255,0.45)",
      fontWeight: "900",
      letterSpacing: 1.1,
      fontSize: 11,
      marginBottom: 8,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "baseline",
      gap: 6,
      paddingBottom: 2,
    },
    totalValue: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 42,
      letterSpacing: -0.8,
    },
    totalUnit: { color: primary, fontWeight: "900", fontSize: 18 },

    secondaryLink: { alignItems: "center", paddingVertical: 10 },
    secondaryLinkText: {
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "800",
    },

    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sectionLabel: {
      color: "rgba(255,255,255,0.55)",
      fontWeight: "900",
      letterSpacing: 1.1,
      fontSize: 12,
    },

    todayCard: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      borderRadius: 18,
      padding: 14,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.12)",
      marginBottom: 18,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.10)",
    },
    todayTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
    todaySub: {
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "700",
      marginTop: 4,
    },

    downDot: { alignItems: "center", marginBottom: 14 },
    downDotInner: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: primary,
      alignItems: "center",
      justifyContent: "center",
    },

    autoFillPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(37,99,235,0.12)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(37,99,235,0.35)",
    },
    autoFillPillText: {
      color: primary,
      fontWeight: "900",
      fontSize: 11,
      letterSpacing: 0.8,
    },

    nextCard: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(37,99,235,0.55)",
      marginBottom: 16,
    },
    nextCardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    nextCardTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
    comingSoon: { color: primary, fontWeight: "900" },

    nextCardGrid: { flexDirection: "row", gap: 12, marginTop: 14 },
    metricPill: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: "rgba(0,0,0,0.20)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      alignItems: "center",
    },
    metricPillLabel: {
      color: "rgba(255,255,255,0.45)",
      fontWeight: "900",
      fontSize: 11,
      letterSpacing: 1.0,
    },
    metricPillValue: {
      color: primary,
      fontWeight: "900",
      fontSize: 18,
      marginTop: 6,
    },

    nextInfoRow: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: "rgba(37,99,235,0.10)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(37,99,235,0.25)",
    },
    nextInfoText: { color: "rgba(255,255,255,0.75)", fontWeight: "800" },

    footerMuted: {
      textAlign: "center",
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "700",
      marginTop: 6,
      marginBottom: 18,
    },
    footerEm: { color: colors.text, fontWeight: "900" },

    kickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
    },
    kickerText: {
      color: primary,
      fontWeight: "900",
      letterSpacing: 1.2,
      fontSize: 12,
    },

    insightCard: {
      borderRadius: 22,
      padding: 14,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.12)",
      marginBottom: 12,
    },
    insightRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    insightText: { flex: 1 },
    insightKicker: {
      color: "rgba(255,255,255,0.45)",
      fontWeight: "900",
      letterSpacing: 1.1,
      fontSize: 11,
    },
    insightTitle: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 16,
      marginTop: 6,
    },
    insightSub: {
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "700",
      marginTop: 2,
    },
    insightIconWrap: {
      width: 74,
      height: 54,
      borderRadius: 18,
      backgroundColor: "rgba(0,0,0,0.20)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      alignItems: "center",
      justifyContent: "center",
    },

    unlockRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginTop: 12,
    },
    unlockTitle: {
      color: "rgba(255,255,255,0.55)",
      fontWeight: "900",
      letterSpacing: 1.1,
      fontSize: 11,
    },
    unlockSub: {
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "700",
      marginTop: 4,
    },
    unlockRight: { color: colors.text, fontWeight: "900" },
    unlockRightMuted: {
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "800",
    },

    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
      marginTop: 10,
      marginBottom: 16,
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: primary,
    },
  });

  (s as any).__colors = { success, primary };
  return s as any;
};
