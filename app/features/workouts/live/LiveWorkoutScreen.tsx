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
import { getRuntimeId } from "@/lib/runtimeId";

import {
  setSwapPickerCache,
  type SwapPickerOption,
  type Chip,
} from "./swap/swapPickerCache";

type Params = { workoutId?: string; planWorkoutId?: string };

function nowIso() {
  return new Date().toISOString();
}

function secondsBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.floor((b - a) / 1000));
}

/**
 * Timer derivation:
 * - timerElapsedSeconds = accumulated “confirmed” seconds
 * - timerLastActiveAt = anchor when running; null = paused (future)
 */
function timerSecondsFromDraft(d: LiveWorkoutDraft) {
  const base = Number(d.timerElapsedSeconds ?? 0);
  const last = d.timerLastActiveAt;
  if (!last) return base;
  return base + secondsBetween(last, nowIso());
}

function timerTextFromSeconds(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Cold-start normalization:
 * When the app was killed, we DO NOT want the timer to include time since last save.
 *
 * So:
 * - Commit only up to updatedAt (the last saved moment)
 * - Then resume timer from NOW (so it continues while app is alive)
 */
function normalizeTimerOnBoot(d: LiveWorkoutDraft): LiveWorkoutDraft {
  const now = nowIso();

  const elapsed = Number(d.timerElapsedSeconds ?? 0);
  const anchor = d.timerLastActiveAt;

  // If missing anchor, treat as "running from now" (you don't have pause UX yet)
  if (!anchor) {
    return {
      ...d,
      timerElapsedSeconds: elapsed,
      timerLastActiveAt: now,
      updatedAt: now,
    };
  }

  // Commit time ONLY up to last saved time (updatedAt). Ignore anything after that.
  const commitTo = d.updatedAt ?? anchor;
  const add = secondsBetween(anchor, commitTo);

  return {
    ...d,
    timerElapsedSeconds: elapsed + add,
    timerLastActiveAt: now,
    updatedAt: now,
  };
}

function fmtNum(n: number, dp = 0) {
  if (dp === 0) return `${Math.round(n)}`;
  return n.toFixed(dp);
}

function buildExerciseSubtitle(ex: any) {
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

  const uid = userId ?? null;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<LiveWorkoutDraft | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // swap picker cache state (kept as you had it)
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
      setSwapHandler(null);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadSwapPicker() {
      setSwapLoading(true);
      try {
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

        const fav = new Set<string>();
        const usage: Record<string, number> = {};
        const equipSet = new Set<string>();

        for (const o of nextOptions) {
          if (o.isFavorite) fav.add(o.id);
          usage[o.id] = o.sessionsCount ?? 0;
          if (o.equipment) equipSet.add(o.equipment);
        }

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

        const eqList = Array.from(equipSet).sort((a, b) => a.localeCompare(b));

        setSwapOptions(nextOptions);
        setSwapFavoriteIds(fav);
        setSwapUsageById(usage);
        setSwapEquipmentOptions(eqList);
        setSwapMuscleGroups(mg);

        setSwapPickerCache({
          options: nextOptions,
          favoriteIds: fav,
          usageByExerciseId: usage,
          equipmentOptions: eqList,
          muscleGroups: mg,
          loadedAt: Date.now(),
        });
      } catch (e) {
        console.warn("swap picker load failed", e);
      } finally {
        if (alive) setSwapLoading(false);
      }
    }

    if (swapOptions.length === 0) loadSwapPicker();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { persist } = usePersistDraft({
    enabledServer: true,
    serverDebounceMs: 1200,
  });

  // Live Activities sync (existing)
  useLiveActivitySync(draft, true);

  // ---- Timer UI tick ----
  const [timerText, setTimerText] = useState("00:00");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!draft) return;

    setTimerText(timerTextFromSeconds(timerSecondsFromDraft(draft)));

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerText(timerTextFromSeconds(timerSecondsFromDraft(draft)));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [draft?.draftId, draft?.timerElapsedSeconds, draft?.timerLastActiveAt]);

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

        const now = nowIso();
        const currentRuntime = getRuntimeId();

        // hydrate defaults
        const hydrated: LiveWorkoutDraft = {
          ...next,
          timerElapsedSeconds: next.timerElapsedSeconds ?? 0,
          timerLastActiveAt: next.timerLastActiveAt ?? now, // running by default
          updatedAt: next.updatedAt ?? now,
          timerRuntimeId: next.timerRuntimeId ?? null,
        };

        // ✅ cold start detection:
        // if the saved runtimeId differs from current process runtimeId, the app was killed
        const isColdStart =
          hydrated.timerRuntimeId != null &&
          hydrated.timerRuntimeId !== currentRuntime;

        let finalDraft: LiveWorkoutDraft;

        if (isColdStart) {
          // subtract time since last save
          finalDraft = {
            ...normalizeTimerOnBoot(hydrated),
            timerRuntimeId: currentRuntime,
          };
        } else {
          // normal resume/navigation: DO NOT subtract anything
          finalDraft = {
            ...hydrated,
            timerRuntimeId: currentRuntime,
          };
        }

        setDraft(finalDraft);
        persist(finalDraft).catch(() => {});
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
  }, [uid, workoutId, planWorkoutId, persist]);

  // Background/lock -> snapshot only (timer continues in real life)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setDraft((prev) => {
          if (!prev) return prev;
          const now = nowIso();
          const next: LiveWorkoutDraft = {
            ...prev,
            updatedAt: now,
            timerRuntimeId: getRuntimeId(),
          };

          persist(next).catch(() => {});
          return next;
        });
      }
    });
    return () => sub.remove();
  }, [persist]);

  function update(mut: (d: LiveWorkoutDraft) => LiveWorkoutDraft) {
    setDraft((prev) => {
      if (!prev) return prev;

      const now = nowIso();
      const next = mut(prev);

      // IMPORTANT: stamp updatedAt so persist/server debounce works
      const stamped: LiveWorkoutDraft = {
        ...next,
        updatedAt: now,
        timerElapsedSeconds: next.timerElapsedSeconds ?? 0,
        timerLastActiveAt: next.timerLastActiveAt ?? now,
        timerRuntimeId: getRuntimeId(),
      };

      persist(stamped).catch(() => {});
      return stamped;
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
            stopLiveWorkout();
            await clearLiveDraftForUser(uid);
            await clearServerDraft(uid);
            router.back();
          },
        },
      ]
    );
  }

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

            const realIndex = draft.exercises.findIndex((e: any) => {
              if (e.workoutExerciseId && ex.workoutExerciseId) {
                return e.workoutExerciseId === ex.workoutExerciseId;
              }
              return (
                e.exerciseId === ex.exerciseId && e.orderIndex === ex.orderIndex
              );
            });

            const indexToOpen = realIndex >= 0 ? realIndex : idx;

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

          setSheetOpen(false);

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

            setTimeout(() => setSheetOpen(true), 0);
            setSwapHandler(null);
          });

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
