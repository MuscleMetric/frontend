// app/features/workouts/live/session/ActiveWorkoutSessionProvider.tsx

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { router, usePathname } from "expo-router";

import { useAuth } from "@/lib/authContext";
import { loadLiveDraftForUser } from "@/app/features/workouts/live/persist/local";
import type { LiveWorkoutDraft } from "../state/types";
import type { ActiveWorkoutSessionContextValue } from "./types";
import { timerSecondsFromSnapshot, timerTextFromSeconds } from "./time";
import { ActiveWorkoutLiveActivityBridge } from "./ActiveWorkoutLiveActivityBridge";

export const ActiveWorkoutSessionContext =
  createContext<ActiveWorkoutSessionContextValue | null>(null);

type Props = {
  children: React.ReactNode;
};

function toDraft(raw: any): LiveWorkoutDraft | null {
  if (!raw || !raw.draftId || !raw.userId) return null;
  return raw as LiveWorkoutDraft;
}

export function ActiveWorkoutSessionProvider({ children }: Props) {
  const { session } = useAuth();
  const pathname = usePathname();

  const userId = session?.user?.id ?? null;

  const [activeDraft, setActiveDraft] = useState<LiveWorkoutDraft | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerText, setTimerText] = useState("00:00");
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActiveDraft(null);
      setElapsedSeconds(0);
      setTimerText("00:00");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const draft = await loadLiveDraftForUser(userId);
      const nextDraft = toDraft(draft);

      setActiveDraft(nextDraft);

      if (nextDraft) {
        const secs = timerSecondsFromSnapshot({
          draftId: nextDraft.draftId,
          userId: nextDraft.userId,
          workoutId: nextDraft.workoutId ?? null,
          planWorkoutId: nextDraft.planWorkoutId ?? null,
          title: nextDraft.title ?? null,
          startedAt: nextDraft.startedAt ?? null,
          updatedAt: nextDraft.updatedAt ?? null,
          timerElapsedSeconds: nextDraft.timerElapsedSeconds ?? 0,
          timerLastActiveAt: nextDraft.timerLastActiveAt ?? null,
        });
        setElapsedSeconds(secs);
        setTimerText(timerTextFromSeconds(secs));
      } else {
        setElapsedSeconds(0);
        setTimerText("00:00");
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const clearSnapshot = useCallback(() => {
    setActiveDraft(null);
    setElapsedSeconds(0);
    setTimerText("00:00");
  }, []);

  const resumeWorkout = useCallback(() => {
    if (!activeDraft) return;

    router.push({
      pathname: "/features/workouts/live",
      params: {
        workoutId: activeDraft.workoutId ?? "",
        planWorkoutId: activeDraft.planWorkoutId ?? "",
      },
    } as any);
  }, [activeDraft]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      }
    });

    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!activeDraft) return;

    const sync = () => {
      const secs = timerSecondsFromSnapshot({
        draftId: activeDraft.draftId,
        userId: activeDraft.userId,
        workoutId: activeDraft.workoutId ?? null,
        planWorkoutId: activeDraft.planWorkoutId ?? null,
        title: activeDraft.title ?? null,
        startedAt: activeDraft.startedAt ?? null,
        updatedAt: activeDraft.updatedAt ?? null,
        timerElapsedSeconds: activeDraft.timerElapsedSeconds ?? 0,
        timerLastActiveAt: activeDraft.timerLastActiveAt ?? null,
      });
      setElapsedSeconds(secs);
      setTimerText(timerTextFromSeconds(secs));
    };

    sync();
    intervalRef.current = setInterval(sync, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    activeDraft?.draftId,
    activeDraft?.timerElapsedSeconds,
    activeDraft?.timerLastActiveAt,
  ]);

  const value = useMemo<ActiveWorkoutSessionContextValue>(
    () => ({
      activeDraft,
      hasActiveWorkout: !!activeDraft,
      elapsedSeconds,
      timerText,
      loading,
      refresh,
      clearSnapshot,
      resumeWorkout,
    }),
    [
      activeDraft,
      elapsedSeconds,
      timerText,
      loading,
      refresh,
      clearSnapshot,
      resumeWorkout,
    ],
  );

  return (
    <ActiveWorkoutSessionContext.Provider value={value}>
      <ActiveWorkoutLiveActivityBridge />
      {children}
    </ActiveWorkoutSessionContext.Provider>
  );
}