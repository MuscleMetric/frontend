// app/features/workouts/live/LiveWorkoutScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, Text, Alert, AppState } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/lib/authContext";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card, LoadingScreen, ErrorState } from "@/ui";

import type { LiveWorkoutDraft } from "./state/types";
import { bootLiveDraft } from "./boot/bootLiveDraft";
import { usePersistDraft } from "./persist/usePersistDraft";
import { clearLiveDraftForUser } from "./persist/local";
import { clearServerDraft } from "./persist/server";

import { openExercise } from "./state/mutators";
import * as M from "./state/mutators";
import * as S from "./state/selectors";

import { LiveHeader } from "./ui/LiveHeader";
import { LiveWorkoutExerciseRow } from "./ui/LiveWorkoutExerciseRow";
import { LiveStickyFooter } from "./ui/LiveStickyFooter";
import { ExerciseEntryModal } from "./modals/ExerciseEntryModal";

import { useLiveActivitySync } from "./liveActivity/useLiveActivitySync";
import { stopLiveWorkout } from "@/lib/liveWorkout";
import { supabase } from "@/lib/supabase";

import { setSwapHandler } from "./swap/swapBus";

import {
  setSwapPickerCache,
  type SwapPickerOption,
  type Chip,
} from "./swap/swapPickerCache";

type Params = { workoutId?: string; planWorkoutId?: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function timerTextFromStartedAt(startedAtIso: string) {
  const startMs = new Date(startedAtIso).getTime();
  const nowMs = Date.now();
  const diff = Math.max(0, nowMs - startMs);
  const totalSeconds = Math.floor(diff / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

function fmtNum(n: number, dp = 0) {
  if (dp === 0) return `${Math.round(n)}`;
  return n.toFixed(dp);
}

function buildExerciseSubtitle(ex: any) {
  // ex is LiveExerciseDraft
  const type = (ex.type ?? "").toLowerCase();
  const p = ex.prescription ?? {};
  const targetSets = p.targetSets ?? ex.sets?.length ?? 0;

  if (type === "cardio") {
    const parts: string[] = [];
    parts.push(`${targetSets} sets`);
    if (p.targetDistance != null)
      parts.push(`${fmtNum(p.targetDistance, 2)}km`);
    if (p.targetTimeSeconds != null)
      parts.push(`${fmtNum(p.targetTimeSeconds)}s`);
    return parts.join(" • ");
  }

  // strength default
  if (p.targetReps != null && p.targetWeight != null) {
    return `${targetSets} sets × ${p.targetReps} • ${fmtNum(p.targetWeight)}kg`;
  }
  if (p.targetReps != null) return `${targetSets} sets × ${p.targetReps}`;
  if (p.targetWeight != null)
    return `${targetSets} sets • ${fmtNum(p.targetWeight)}kg`;

  return `${ex.sets?.length ?? 0} sets`;
}

export default function LiveWorkoutScreen() {
  const { userId } = useAuth();
  const { colors, typography, layout } = useAppTheme();
  const params = useLocalSearchParams<Params>();

  const workoutId =
    typeof params.workoutId === "string" ? params.workoutId : undefined;
  const planWorkoutId =
    typeof params.planWorkoutId === "string" ? params.planWorkoutId : undefined;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<LiveWorkoutDraft | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapExerciseIndex, setSwapExerciseIndex] = useState<number | null>(
    null
  );
  const [swapOptions, setSwapOptions] = useState<SwapPickerOption[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);

  const [swapFavoriteIds, setSwapFavoriteIds] = useState<Set<string>>(
    new Set()
  );
  const [swapUsageById, setSwapUsageById] = useState<Record<string, number>>(
    {}
  );
  const [swapEquipmentOptions, setSwapEquipmentOptions] = useState<string[]>(
    []
  );
  const [swapMuscleGroups, setSwapMuscleGroups] = useState<Chip[]>([]);

  useEffect(() => {
    return () => {
      // IMPORTANT: cleanup so we don't keep stale handlers around
      setSwapHandler(null);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setSwapLoading(true);
      try {
        // 1) rpc: exercises + user meta
        const { data, error } = await supabase.rpc("get_exercise_picker_data", {
          p_include_private: false,
        });
        if (error) throw error;
        if (!alive) return;

        const rows = (data ?? []) as any[];

        const nextOptions: SwapPickerOption[] = rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type ?? null,
          equipment: r.equipment ?? null,
          level: r.level ?? null,
          instructions: r.instructions ?? null,

          muscleIds: Array.isArray(r.muscle_ids)
            ? r.muscle_ids.map((x: any) => String(x))
            : [],

          isFavorite: Boolean(r.is_favorite),
          sessionsCount: Number(r.sessions_count ?? 0),
          setsCount: Number(r.sets_count ?? 0),
          lastUsedAt: r.last_used_at ?? null,
        }));

        // derive fav + usage + equipment list
        const fav = new Set<string>();
        const usage: Record<string, number> = {};
        const equipSet = new Set<string>();

        for (const o of nextOptions) {
          if (o.isFavorite) fav.add(o.id);
          usage[o.id] = o.sessionsCount ?? 0;
          if (o.equipment) equipSet.add(o.equipment);
        }

        // 2) muscles table for filter chips
        const { data: muscles, error: mErr } = await supabase
          .from("muscles")
          .select("id,name")
          .order("name", { ascending: true });

        const mg: Chip[] = mErr
          ? []
          : (muscles ?? []).map((m: any) => ({
              id: String(m.id),
              label: m.name,
            }));

        if (!alive) return;

        // write state
        setSwapOptions(nextOptions);
        setSwapFavoriteIds(fav);
        setSwapUsageById(usage);
        setSwapEquipmentOptions(
          Array.from(equipSet).sort((a, b) => a.localeCompare(b))
        );
        setSwapMuscleGroups(mg);

        // ✅ write global cache so swap page doesn't refetch
        setSwapPickerCache({
          options: nextOptions,
          favoriteIds: fav,
          usageByExerciseId: usage,
          equipmentOptions: Array.from(equipSet).sort((a, b) =>
            a.localeCompare(b)
          ),
          muscleGroups: mg,
          loadedAt: Date.now(),
        });
      } catch (e) {
        console.warn("swap picker load failed", e);
      } finally {
        if (alive) setSwapLoading(false);
      }
    }

    // only fetch if we don't already have them
    if (swapOptions.length === 0) load();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log("swapOpen state =", swapOpen);
  }, [swapOpen]);

  const uid = userId ?? null;

  const { persist } = usePersistDraft({
    enabledServer: true,
    serverDebounceMs: 1200,
  });

  // Live Activities sync (your existing hook)
  useLiveActivitySync(draft, true);

  // ---- Timer (ticks every second while draft exists) ----
  const [timerText, setTimerText] = useState("00:00");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!draft?.startedAt) return;

    // prime immediately
    setTimerText(timerTextFromStartedAt(draft.startedAt));

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimerText(timerTextFromStartedAt(draft.startedAt));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [draft?.startedAt]);

  // ---- Boot draft ----
  useEffect(() => {
    let cancelled = false;

    async function boot() {
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
        setErr(e?.message ?? "Failed to start workout session");
        setLoading(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [uid, workoutId, planWorkoutId]);

  // App background -> flush save
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && draft) {
        persist(draft).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [draft, persist]);

  function update(mut: (d: LiveWorkoutDraft) => LiveWorkoutDraft) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = mut(prev);
      persist(next).catch(() => {});
      return next;
    });
  }

  function openExerciseAt(index: number) {
    update((d) => openExercise(d, index));
    setSheetOpen(true);
  }

  async function discardSessionConfirmed() {
    if (!uid) return;
    stopLiveWorkout();
    await clearLiveDraftForUser(uid);
    await clearServerDraft(uid);
    router.back();
  }

  function confirmDiscard() {
    Alert.alert(
      "Leave workout?",
      "If you leave now, this workout won't be saved.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: discardSessionConfirmed,
        },
      ]
    );
  }

  async function completeWorkout() {
    if (!uid || !draft) return;

    Alert.alert(
      "Complete workout?",
      "This will close your live session. Your workout will be saved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            // TODO: write workout_history + set history here
            stopLiveWorkout();
            await clearLiveDraftForUser(uid);
            await clearServerDraft(uid);
            router.back();
          },
        },
      ]
    );
  }

  // ✅ Hooks must run in consistent order — put memos BEFORE any early returns
  const supersetLabels = useMemo(() => {
    if (!draft) return {} as Record<string, string>;
    return S.buildSupersetLabels(draft);
  }, [draft?.exercises]);

  const sortedExercises = useMemo(() => {
    if (!draft) return [] as any[];
    return draft.exercises
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [draft?.exercises]);

  // ---- Early returns AFTER hooks ----
  if (!uid) {
    return (
      <ErrorState
        title="Not signed in"
        message="Please log in to start a workout."
      />
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

          router.replace({
            pathname: "/features/workouts/live",
            params: nextParams,
          });
        }}
      />
    );
  }

  const progress = S.getProgress(draft);
  const footerDisabled = !S.canCompleteWorkout(draft);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LiveHeader
        title={draft.title}
        subtitle="In Progress"
        timerText={timerText}
        onClose={confirmDiscard}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: layout.space.lg,
          paddingBottom: 150,
          gap: layout.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontFamily: typography.fontFamily.semibold,
                fontSize: typography.size.body,
                color: colors.text,
              }}
            >
              Keep moving
            </Text>
            <Text
              style={{
                fontFamily: typography.fontFamily.regular,
                fontSize: typography.size.sub,
                color: colors.textMuted,
              }}
            >
              Tap an exercise to log sets. Everything autosaves.
            </Text>
          </View>
        </Card>

        <View style={{ gap: layout.space.md }}>
          {sortedExercises.map((ex: any, idx: number) => {
            const tags: string[] = [];

            const g = ex.prescription?.supersetGroup;
            if (g && supersetLabels[g]) tags.push(supersetLabels[g]);
            if (ex.prescription?.isDropset) tags.push("Dropset");

            const subtitleBase = buildExerciseSubtitle(ex);

            const lastLabel = S.getLastSessionLabel(ex);
            const subtitle = lastLabel
              ? `${subtitleBase} • Last: ${lastLabel}`
              : subtitleBase;

            // ✅ IMPORTANT: map sorted item back to its real index in draft.exercises
            const realIndex = draft.exercises.findIndex((e: any) => {
              // prefer workoutExerciseId when present (most stable)
              if (e.workoutExerciseId && ex.workoutExerciseId) {
                return e.workoutExerciseId === ex.workoutExerciseId;
              }
              // fallback: exerciseId + orderIndex (good enough for now)
              return (
                e.exerciseId === ex.exerciseId && e.orderIndex === ex.orderIndex
              );
            });

            const indexToOpen = realIndex >= 0 ? realIndex : idx; // fallback (should rarely hit)

            return (
              <LiveWorkoutExerciseRow
                key={
                  ex.workoutExerciseId ??
                  `${ex.exerciseId}-${ex.orderIndex ?? idx}`
                }
                index={idx + 1}
                title={ex.name}
                subtitle={subtitle}
                tags={tags.length ? tags : undefined}
                ex={ex}
                onPress={() => openExerciseAt(indexToOpen)}
              />
            );
          })}
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      <LiveStickyFooter
        disabled={footerDisabled}
        title={`Complete Workout (${progress.done}/${progress.total} exercises)`}
        onPress={completeWorkout}
      />

      <ExerciseEntryModal
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        draft={draft}
        onUpdateSetValue={(a) => update((d) => M.updateSetValue(d, a))}
        onAddSet={(i) => update((d) => M.addSet(d, i))}
        onRemoveSet={(i) => update((d) => M.removeSet(d, i))}
        onPrevSet={() => update((d) => M.goPrevSet(d))}
        onNextSet={() => update((d) => M.goNextSupersetAware(d))}
        onSwapExercise={() => {
          const exIndex = draft.ui.activeExerciseIndex;

          // close the entry sheet
          setSheetOpen(false);

          // set the handler BEFORE navigation so the swap page can return a result
          setSwapHandler((picked) => {
            update((d) =>
              M.swapExercise(d, {
                exerciseIndex: exIndex,
                newExercise: {
                  exerciseId: picked.id,
                  name: picked.name ?? "Exercise",
                  equipment: picked.equipment ?? null,
                  type: picked.type ?? null,
                  level: picked.level ?? null,
                  instructions: picked.instructions ?? null,
                },
                resetSuperset: false,
                resetDropsetFlag: false,
              })
            );

            // optional: reopen the entry modal for the swapped exercise
            setTimeout(() => setSheetOpen(true), 0);

            // clear handler so it can’t fire again
            setSwapHandler(null);
          });

          // push the swap page
          router.push({
            pathname: "/features/workouts/live/swap/",
            params: {
              replacingExerciseId: draft.exercises[exIndex]?.exerciseId ?? "",
            },
          });
        }}
        onToggleDropset={(exerciseIndex, value) =>
          update((d) => M.setExerciseDropSet(d, { exerciseIndex, value }))
        }
        onJumpToExercise={(exerciseIndex) =>
          update((d) => M.openExercise(d, exerciseIndex))
        }
        onInitDropSetForSet={(a) => update((d) => M.initDropSetForSet(d, a))}
        onClearDropSetForSet={(a) => update((d) => M.clearDropSetForSet(d, a))}
        onAddDrop={(a) => update((d) => M.addDrop(d, a))}
        onUpdateDropSetValue={(a) => update((d) => M.updateDropSetValue(d, a))}
        onRemoveDrop={(a) => update((d) => M.removeDrop(d, a))}
      />
    </View>
  );
}
