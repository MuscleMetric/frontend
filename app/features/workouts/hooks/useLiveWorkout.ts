// app/features/workouts/hooks/useLiveWorkout.ts
import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

type Bootstrap = {
  workout: {
    workoutId: string;
    title: string;
    notes: string | null;
    imageKey: string | null;
    isPlanWorkout: boolean;
    planWorkoutId: string | null;
  };
  headerStats: {
    avgDurationSeconds: number | null;
    avgTotalVolume: number | null;
  };
  goals: Array<{
    id: string;
    type: string;
    targetNumber: number;
    unit: string | null;
    deadline: string | null;
    exerciseId: string | null;
    notes: string | null;
  }>;
  exercises: Array<{
    workoutExerciseId: string;
    exerciseId: string;
    orderIndex: number;

    name: string;
    equipment: string | null;
    type: string | null;
    level: string | null;
    videoUrl: string | null;
    instructions: string | null;

    prescription: {
      targetSets: number | null;
      targetReps: number | null;
      targetWeight: number | null;
      targetTimeSeconds: number | null;
      targetDistance: number | null;
      notes: string | null;
      supersetGroup: string | null;
      supersetIndex: number | null;
      isDropset: boolean | null;
    };

    lastSession: {
      completedAt: string | null;
      sets: Array<{
        setNumber: number;
        dropIndex: number;
        reps: number | null;
        weight: number | null;
        timeSeconds: number | null;
        distance: number | null;
        notes: string | null;
      }>;
    };

    bestE1rm: number | null;
    totalVolumeAllTime: number | null;
  }>;
};

export type LiveDraft = {
  // identifies which workout this draft belongs to
  workoutId: string;
  planWorkoutId: string | null;

  // app-level session identity (client only)
  startedAtIso: string;

  // the user can reorder / complete exercises etc.
  // keep it minimal for now; expand as you implement live logging
  completedExerciseIds: string[];
  exerciseOrder: string[]; // array of exerciseId in desired order

  // per-exercise in-progress notes or set entries (future-proof shape)
  perExercise: Record<
    string,
    {
      notes?: string;
      // later: sets[], currentSetIndex, etc.
    }
  >;
};

function draftKey(userId: string, workoutId: string, planWorkoutId: string | null) {
  const suffix = planWorkoutId ? `pw:${planWorkoutId}` : `w:${workoutId}`;
  return `mm:liveDraft:${userId}:${suffix}`;
}

function secondsToRangeLabel(sec: number | null | undefined) {
  if (!sec || sec <= 0) return null;
  const min = Math.round(sec / 60);
  // simple +-10% range
  const lo = Math.max(1, Math.round(min * 0.9));
  const hi = Math.max(lo, Math.round(min * 1.1));
  return `${lo}–${hi} min`;
}

function formatKg(n: number | null | undefined) {
  if (n == null) return null;
  const rounded = Math.round(Number(n));
  return `${rounded.toLocaleString()} kg`;
}

export function useLiveWorkout(args: {
  userId: string | null | undefined;
  workoutId: string | null | undefined;
  planWorkoutId?: string | null | undefined;
}) {
  const userId = args.userId ?? null;
  const workoutId = args.workoutId ?? null;
  const planWorkoutId = args.planWorkoutId ?? null;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [bootstrap, setBootstrap] = React.useState<Bootstrap | null>(null);

  const [draft, setDraft] = React.useState<LiveDraft | null>(null);
  const [hadSavedDraft, setHadSavedDraft] = React.useState(false);

  const key = React.useMemo(() => {
    if (!userId || !workoutId) return null;
    return draftKey(userId, workoutId, planWorkoutId);
  }, [userId, workoutId, planWorkoutId]);

  const load = React.useCallback(async () => {
    if (!userId || !workoutId) return;
    setLoading(true);
    setError(null);

    try {
      // 1) fetch bootstrap data from RPC
      const { data, error: rpcErr } = await supabase.rpc("get_workout_session_bootstrap", {
        p_workout_id: workoutId,
        p_plan_workout_id: planWorkoutId, // can be null
      });

      if (rpcErr) throw rpcErr;

      setBootstrap(data as Bootstrap);

      // 2) read any existing local draft
      if (key) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as LiveDraft;
            setDraft(parsed);
            setHadSavedDraft(true);
          } catch {
            // corrupted draft -> remove
            await AsyncStorage.removeItem(key);
            setDraft(null);
            setHadSavedDraft(false);
          }
        } else {
          setDraft(null);
          setHadSavedDraft(false);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load workout.");
    } finally {
      setLoading(false);
    }
  }, [userId, workoutId, planWorkoutId, key]);

  React.useEffect(() => {
    if (!userId || !workoutId) return;
    load();
  }, [userId, workoutId, load]);

  const createDraft = React.useCallback(async () => {
    if (!userId || !workoutId || !bootstrap || !key) return null;

    const newDraft: LiveDraft = {
      workoutId,
      planWorkoutId,
      startedAtIso: new Date().toISOString(),
      completedExerciseIds: [],
      exerciseOrder: bootstrap.exercises
        .slice()
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map((e) => e.exerciseId),
      perExercise: {},
    };

    setDraft(newDraft);
    setHadSavedDraft(true);
    await AsyncStorage.setItem(key, JSON.stringify(newDraft));
    return newDraft;
  }, [userId, workoutId, planWorkoutId, bootstrap, key]);

  const updateDraft = React.useCallback(
    async (patch: (prev: LiveDraft) => LiveDraft) => {
      if (!key) return;
      setDraft((prev) => {
        if (!prev) return prev;
        const next = patch(prev);
        // fire-and-forget save (still awaited outside if you want)
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [key]
  );

  const discardDraft = React.useCallback(async () => {
    if (!key) return;
    await AsyncStorage.removeItem(key);
    setDraft(null);
    setHadSavedDraft(false);
  }, [key]);

  const headerChips = React.useMemo(() => {
    const s = bootstrap?.headerStats;
    if (!s) return [];
    const out: Array<{ label: string; value: string }> = [];

    const dur = secondsToRangeLabel(s.avgDurationSeconds);
    if (dur) out.push({ label: "Duration", value: dur });

    const vol = formatKg(s.avgTotalVolume);
    if (vol) out.push({ label: "Avg volume", value: vol });

    return out;
  }, [bootstrap]);

  return {
    loading,
    error,
    bootstrap,
    headerChips,

    draft,
    hadSavedDraft,

    reload: load,
    createDraft,
    updateDraft,
    discardDraft,
  };
}
