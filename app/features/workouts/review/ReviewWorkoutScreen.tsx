// app/features/workouts/live/review/ReviewWorkoutScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/lib/authContext";
import { useAppTheme } from "@/lib/useAppTheme";

import type { LiveWorkoutDraft } from "../live/state/types";
import { bootLiveDraft } from "../live/boot/bootLiveDraft";
import { clearLiveDraftForUser } from "../live/persist/local";
import { clearServerDraft } from "../live/persist/server";
import { stopLiveWorkout } from "@/lib/liveWorkout";

import { LoadingScreen, ErrorState } from "@/ui";

import { ReviewHeader } from "./ui/ReviewHeader";
import { SummaryGrid } from "./ui/SummaryGrid";
import { ValidationCard } from "./ui/ValidationCard";
import { ExerciseReviewCard } from "./ui/ExerciseReviewCard";
import { SaveFooter } from "./ui/SaveFooter";

import { useReviewData } from "./useReviewData";

// ✅ Your save function (the one that calls save_completed_workout_v1)
// Make sure the path matches where you placed it.
import { saveCompletedWorkoutFromLiveDraft } from "@/lib/saveWorkout";

type Params = { workoutId?: string; planWorkoutId?: string };

function newClientSaveId() {
  // simple UUID v4 fallback (good enough client-side)
  // If you already have a uuid util in your codebase, swap to that.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ReviewWorkoutScreen() {
  const { colors, layout } = useAppTheme();
  const { userId } = useAuth();
  const params = useLocalSearchParams<Params>();

  const workoutId = typeof params.workoutId === "string" ? params.workoutId : undefined;
  const planWorkoutId = typeof params.planWorkoutId === "string" ? params.planWorkoutId : undefined;

  const uid = userId ?? null;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<LiveWorkoutDraft | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!uid) return;
      setLoading(true);
      setErr(null);

      try {
        const next = await bootLiveDraft({
          userId: uid,
          workoutId,
          planWorkoutId: planWorkoutId ?? null,
          preferServer: true,
        });

        if (cancelled) return;
        setDraft(next);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load workout for review.");
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [uid, workoutId, planWorkoutId]);

  const vm = useReviewData(draft);

  // “Can save” rule: at least 1 exercise has at least 1 completed set
  const canSave = useMemo(() => {
    if (!vm) return false;
    return vm.summary.setsCompleted > 0;
  }, [vm]);

  async function doSave() {
    if (!uid || !draft || !vm) return;

    if (!canSave) {
      Alert.alert("Nothing to save", "Add at least one completed set before saving.");
      return;
    }

    Alert.alert(
      "Save workout?",
      "This will save your workout and close the session.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            try {
              setSaving(true);

              // ✅ Map LiveWorkoutDraft -> saveWorkout.ts args
              // You said: “get lib/saveWorkout.ts working with LiveWorkoutDraft first”
              // So we pass a “payload-like” object that saveWorkout.ts expects.
              //
              // IMPORTANT:
              // Your saveWorkout.ts you mentioned earlier must include a builder that accepts LiveWorkoutDraft.
              // If your current saveWorkout.ts still expects the old ReviewPayload type,
              // tell me and I’ll adapt it in-place to accept LiveWorkoutDraft.
              const clientSaveId = newClientSaveId();

              // duration seconds (stable committed)
              const durationSeconds = Number(draft.timerElapsedSeconds ?? 0);

              const completedAt = new Date();

              await saveCompletedWorkoutFromLiveDraft({
                clientSaveId,
                // @ts-expect-error — your implementation should accept LiveWorkoutDraft mapping
                payload: draft,
                totalDurationSec: durationSeconds,
                completedAt,
                planWorkoutIdToComplete: planWorkoutId,
              });

              // ✅ only clear AFTER successful save
              stopLiveWorkout();
              await clearLiveDraftForUser(uid);
              await clearServerDraft(uid);

              // Leave review screen + live screen
              router.back(); // back to LiveWorkoutScreen
              setTimeout(() => router.back(), 0); // exit live session route
            } catch (e: any) {
              Alert.alert("Save failed", e?.message ?? "Something went wrong while saving.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  if (!uid) {
    return <ErrorState title="Not signed in" message="Please log in to save a workout." />;
  }

  if (loading) return <LoadingScreen />;

  if (err || !draft || !vm) {
    return (
      <ErrorState
        title="Couldn’t open review"
        message={err ?? "Unknown error"}
        onRetry={() => {
          setErr(null);
          setDraft(null);
          setLoading(true);
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ReviewHeader
        title="Review Workout"
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: layout.space.lg,
          paddingBottom: 140,
          gap: layout.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SummaryGrid summary={vm.summary} />

        <ValidationCard
          issues={vm.issues}
          onPressReview={() => {
            // Basic behaviour: just scroll naturally. (If you want “jump to first issue” with refs, we’ll add it next.)
          }}
        />

        {/* Exercise Breakdown */}
        <View style={{ gap: 12 }}>
          {vm.exercises.map((ex, idx) => (
            <ExerciseReviewCard key={`${ex.id}-${ex.orderIndex}`} index={idx} exercise={ex} />
          ))}
        </View>
      </ScrollView>

      <SaveFooter
        saving={saving}
        disabled={!canSave}
        onPressSave={doSave}
        hint="This will save your workout and close the session."
      />
    </View>
  );
}
