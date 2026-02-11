// app/onboarding/stage2/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";

import WorkoutSaved from "./WorkoutSavedScreen";
import RememberSets from "./RememberSetsScreen";
import UnlockingInsights from "./UnlockInsightsScreen"; // ✅ this is the file you pasted

/**
 * Stage 2: after exactly 1 workout (gated by get_onboarding_gate_v1)
 * Uses RPC: public.get_last_workout_onboarding_payload_v1()
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

  // if you actually return these, keep this field
  tracked_sets?: any[];
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

export default function Stage2Onboarding() {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<Step>(0);
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

  function next() {
    setStep((s) => Math.min(2, s + 1) as Step);
  }

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
            unitWeight={unitWeight ?? "kg"}
            trackedSets={payload?.tracked_sets ?? []}
            workoutTitle={workoutTitle}
            onPrimary={next}
          />
        ) : (
          <UnlockingInsights workoutsCompleted={payload?.workouts_completed ?? 1} />
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: any) => {
  const primary = colors.primary ?? "#2563EB";

  return StyleSheet.create({
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
  });
};
