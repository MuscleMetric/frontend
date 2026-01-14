// app/features/workouts/live/LiveWorkoutScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, Alert, AppState } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/authContext";
import { useAppTheme } from "@/lib/useAppTheme";
import { Screen, Button, Card, LoadingScreen, ErrorState } from "@/ui";

import type { WorkoutLoadPayload, LiveWorkoutDraft } from "../hooks/liveWorkoutTypes";
import { buildDraftFromPayload } from "../hooks/buildDraft";
import {
  loadLiveWorkoutDraft,
  saveLiveWorkoutDraft,
  clearLiveWorkoutDraft,
} from "../hooks/liveWorkoutStorage";

import { ExerciseEntrySheet } from "./components/ExerciseEntrySheet";
import { LiveWorkoutTopBar } from "./components/LiveWorkoutTopBar";
import { LiveWorkoutExerciseRow } from "./components/LiveWorkoutExerciseRow";

type Params = {
  workoutId?: string;
  planWorkoutId?: string;
};

export default function LiveWorkoutScreen() {
  const { userId } = useAuth();
  const { colors, typography, layout } = useAppTheme();
  const params = useLocalSearchParams<Params>();

  const workoutId = typeof params.workoutId === "string" ? params.workoutId : undefined;
  const planWorkoutId = typeof params.planWorkoutId === "string" ? params.planWorkoutId : undefined;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState<LiveWorkoutDraft | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Hard guard: from here on, uid is definitely a string (fixes your TS errors)
  if (!userId) {
    return (
      <ErrorState title="Not signed in" message="Please log in to start a workout." />
    );
  }
  const uid = userId;

  const activeExercise = useMemo(() => {
    if (!draft) return null;
    const idx = Math.max(0, Math.min(draft.exercises.length - 1, draft.ui.activeExerciseIndex));
    return draft.exercises[idx] ?? null;
  }, [draft]);

  async function persist(next: LiveWorkoutDraft) {
    setDraft(next);
    await saveLiveWorkoutDraft(next);
  }

  function updateDraft(mutator: (d: LiveWorkoutDraft) => LiveWorkoutDraft) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = mutator(prev);
      saveLiveWorkoutDraft(next).catch(() => {});
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      setErr(null);

      try {
        // 1) Resume existing draft if it exists
        const existing = await loadLiveWorkoutDraft(uid);
        if (existing) {
          if (cancelled) return;
          setDraft(existing);
          setLoading(false);
          return;
        }

        // 2) No draft exists -> need workoutId
        if (!workoutId) {
          if (cancelled) return;
          setErr("No workoutId provided to start a session.");
          setLoading(false);
          return;
        }

        // 3) Fetch bootstrap from RPC
        const { data, error } = await supabase.rpc("get_workout_session_bootstrap", {
          p_workout_id: workoutId,
          p_plan_workout_id: planWorkoutId ?? null, // null if not in plan
        });
        if (error) throw error;

        const payload = data as WorkoutLoadPayload;

        // 4) Build + persist immediately
        const nextDraft = buildDraftFromPayload({ userId: uid, payload });
        await saveLiveWorkoutDraft(nextDraft);

        if (cancelled) return;
        setDraft(nextDraft);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to start workout session");
        setLoading(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [uid, workoutId, planWorkoutId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        const d = draft;
        if (d) saveLiveWorkoutDraft(d).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [draft]);

  function openExercise(index: number) {
    updateDraft((d) => ({
      ...d,
      ui: { ...d.ui, activeExerciseIndex: index, activeSetNumber: 1 },
      updatedAt: new Date().toISOString(),
    }));
    setSheetOpen(true);
  }

  function markExerciseDone(exerciseIndex: number, done: boolean) {
    updateDraft((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return d;

      const nextExercises = d.exercises.slice();
      nextExercises[exerciseIndex] = { ...ex, isDone: done };
      return { ...d, exercises: nextExercises, updatedAt: new Date().toISOString() };
    });
  }

  function addSet(exerciseIndex: number) {
    updateDraft((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return d;

      const lastSetNum = ex.sets.length ? ex.sets[ex.sets.length - 1].setNumber : 0;
      const nextSetNumber = Math.min(20, lastSetNum + 1);

      const nextExercises = d.exercises.slice();
      nextExercises[exerciseIndex] = {
        ...ex,
        sets: [
          ...ex.sets,
          {
            setNumber: nextSetNumber,
            dropIndex: 0,
            reps: null,
            weight: null,
            timeSeconds: null,
            distance: null,
            notes: null,
          },
        ],
      };

      return { ...d, exercises: nextExercises, updatedAt: new Date().toISOString() };
    });
  }

  function removeSet(exerciseIndex: number) {
    updateDraft((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return d;
      if (ex.sets.length <= 1) return d;

      const nextExercises = d.exercises.slice();
      nextExercises[exerciseIndex] = { ...ex, sets: ex.sets.slice(0, -1) };

      const nextActiveSet = Math.min(d.ui.activeSetNumber, nextExercises[exerciseIndex].sets.length);

      return {
        ...d,
        exercises: nextExercises,
        ui: { ...d.ui, activeSetNumber: nextActiveSet },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function updateSetValue(args: {
    exerciseIndex: number;
    setNumber: number;
    field: "reps" | "weight" | "timeSeconds" | "distance";
    value: number | null;
  }) {
    updateDraft((d) => {
      const ex = d.exercises[args.exerciseIndex];
      if (!ex) return d;

      const nextSets = ex.sets.map((s) =>
        s.setNumber === args.setNumber ? { ...s, [args.field]: args.value } : s
      );

      const nextExercises = d.exercises.slice();
      nextExercises[args.exerciseIndex] = { ...ex, sets: nextSets };

      return { ...d, exercises: nextExercises, updatedAt: new Date().toISOString() };
    });
  }

  function goPrevSet() {
    updateDraft((d) => ({
      ...d,
      ui: { ...d.ui, activeSetNumber: Math.max(1, d.ui.activeSetNumber - 1) },
      updatedAt: new Date().toISOString(),
    }));
  }

  function goNextSet() {
    updateDraft((d) => {
      const ex = d.exercises[d.ui.activeExerciseIndex];
      const maxSet = ex?.sets.length ?? d.ui.activeSetNumber;
      return {
        ...d,
        ui: { ...d.ui, activeSetNumber: Math.min(maxSet, d.ui.activeSetNumber + 1) },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async function completeWorkout() {
    Alert.alert(
      "Complete workout?",
      "This will close your live session. Your workout will be saved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          style: "default",
          onPress: async () => {
            await clearLiveWorkoutDraft(uid);
            router.back();
          },
        },
      ]
    );
  }

  async function cancelSession() {
    Alert.alert(
      "Discard session?",
      "This removes the local draft. Only do this if you truly want to throw away the session.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await clearLiveWorkoutDraft(uid);
            router.back();
          },
        },
      ]
    );
  }

  if (loading) return <LoadingScreen />;

  if (err || !draft) {
    return (
      <ErrorState
        title="Couldn’t start workout"
        message={err ?? "Unknown error"}
        onRetry={() => {
          setErr(null);
          setDraft(null);
          setLoading(true);

          const nextParams: Record<string, string> = {};
          if (workoutId) nextParams.workoutId = workoutId;
          if (planWorkoutId) nextParams.planWorkoutId = planWorkoutId;

          router.replace({ pathname: "/features/workouts/live", params: nextParams });
        }}
      />
    );
  }

  return (
    <Screen>
      <LiveWorkoutTopBar
        title={draft.title}
        onBack={() => router.back()}
        onMore={() => {
          Alert.alert("Session options", "", [
            { text: "Cancel workout", style: "destructive", onPress: cancelSession },
            { text: "Close", style: "cancel" },
          ]);
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: layout.space.lg,
          paddingBottom: layout.space.xxl,
          gap: layout.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ gap: layout.space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={{
                  flex: 1,
                  fontFamily: typography.fontFamily.bold,
                  fontSize: typography.size.h2,
                  color: colors.text,
                }}
                numberOfLines={2}
              >
                {draft.title}
              </Text>

              <View style={{ marginLeft: layout.space.sm }}>
                <Button title="Complete" variant="primary" fullWidth={false} onPress={completeWorkout} />
              </View>
            </View>

            <Text
              style={{
                fontFamily: typography.fontFamily.regular,
                fontSize: typography.size.sub,
                color: colors.textMuted,
              }}
            >
              Tap an exercise to start logging. Everything autosaves locally.
            </Text>
          </View>
        </Card>

        <View style={{ gap: layout.space.sm }}>
          {draft.exercises.map((ex, idx) => (
            <LiveWorkoutExerciseRow
              key={`${ex.exerciseId}-${idx}`}
              title={ex.name}
              subtitle={`${ex.sets.length} sets`}
              isDone={ex.isDone}
              onPress={() => openExercise(idx)}
              onToggleDone={() => markExerciseDone(idx, !ex.isDone)}
            />
          ))}
        </View>

        <Button
          title="Add exercise"
          variant="ghost"
          onPress={() => Alert.alert("Add exercise", "We’ll wire this to your exercise picker next.")}
        />
      </ScrollView>

      <ExerciseEntrySheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        draft={draft}
        setDraft={persist}
        onUpdateSetValue={updateSetValue}
        onAddSet={addSet}
        onRemoveSet={removeSet}
        onPrevSet={goPrevSet}
        onNextSet={goNextSet}
        onSwapExercise={() => Alert.alert("Swap exercise", "We’ll wire this to your swap flow next.")}
      />
    </Screen>
  );
}
