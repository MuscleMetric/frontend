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

import type {
  ActiveWorkoutSessionContextValue,
  ActiveWorkoutSnapshot,
} from "./types";
import {
  timerSecondsFromSnapshot,
  timerTextFromSeconds,
} from "./time";

export const ActiveWorkoutSessionContext =
  createContext<ActiveWorkoutSessionContextValue | null>(null);

type Props = {
  children: React.ReactNode;
};

function toSnapshot(raw: any): ActiveWorkoutSnapshot | null {
  if (!raw || !raw.draftId || !raw.userId) return null;

  return {
    draftId: String(raw.draftId),
    userId: String(raw.userId),
    workoutId: raw.workoutId ?? null,
    planWorkoutId: raw.planWorkoutId ?? null,
    title: raw.title ?? null,
    startedAt: raw.startedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    timerElapsedSeconds:
      raw.timerElapsedSeconds == null ? 0 : Number(raw.timerElapsedSeconds),
    timerLastActiveAt: raw.timerLastActiveAt ?? null,
  };
}

export function ActiveWorkoutSessionProvider({ children }: Props) {
  const { session } = useAuth();
  const pathname = usePathname();

  const userId = session?.user?.id ?? null;

  const [activeWorkout, setActiveWorkout] =
    useState<ActiveWorkoutSnapshot | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerText, setTimerText] = useState("00:00");
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActiveWorkout(null);
      setElapsedSeconds(0);
      setTimerText("00:00");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const draft = await loadLiveDraftForUser(userId);
      const snapshot = toSnapshot(draft);

      setActiveWorkout(snapshot);

      if (snapshot) {
        const secs = timerSecondsFromSnapshot(snapshot);
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
    setActiveWorkout(null);
    setElapsedSeconds(0);
    setTimerText("00:00");
  }, []);

  const resumeWorkout = useCallback(() => {
    if (!activeWorkout) return;

    router.push({
      pathname: "/features/workouts/live",
      params: {
        workoutId: activeWorkout.workoutId ?? "",
        planWorkoutId: activeWorkout.planWorkoutId ?? "",
      },
    } as any);
  }, [activeWorkout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // helpful because live/review flows can change persisted state
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

    if (!activeWorkout) return;

    const sync = () => {
      const secs = timerSecondsFromSnapshot(activeWorkout);
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
    activeWorkout?.draftId,
    activeWorkout?.timerElapsedSeconds,
    activeWorkout?.timerLastActiveAt,
  ]);

  const value = useMemo<ActiveWorkoutSessionContextValue>(
    () => ({
      activeWorkout,
      hasActiveWorkout: !!activeWorkout,
      elapsedSeconds,
      timerText,
      loading,
      refresh,
      clearSnapshot,
      resumeWorkout,
    }),
    [
      activeWorkout,
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
      {children}
    </ActiveWorkoutSessionContext.Provider>
  );
}