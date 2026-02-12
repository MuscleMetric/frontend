// app/features/workouts/live/persist/usePersistDraft.ts
import { useCallback, useEffect, useRef } from "react";
import type { LiveWorkoutDraft } from "../state/types";
import { saveLiveDraftForUser } from "./local";
import { upsertServerDraft } from "./server";

const DEBUG_PERSIST = __DEV__;

function dlog(message: string, data?: Record<string, any>) {
  if (!DEBUG_PERSIST) return;
  console.log(`[persistDraft] ${message}`, data ?? {});
}

/**
 * Immediate local persistence + debounced server persistence.
 * Includes pause/resume + debug logs to catch "writes after save".
 */
export function usePersistDraft(args: {
  enabledServer?: boolean; // default true
  serverDebounceMs?: number; // default 1200ms
}) {
  const enabledServer = args.enabledServer ?? true;
  const serverDebounceMs = args.serverDebounceMs ?? 1200;

  const timerRef = useRef<any>(null);
  const lastSentRef = useRef<string>("");
  const pausedRef = useRef<boolean>(false);
  const lastDraftRef = useRef<LiveWorkoutDraft | null>(null);

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      dlog("server timer cancelled");
    }
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    cancelTimer();
    dlog("PAUSE enabled");
  }, [cancelTimer]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    dlog("PAUSE disabled");
  }, []);

  const flushServer = useCallback(async () => {
    if (!enabledServer) {
      dlog("flushServer skipped (server disabled)");
      return;
    }
    if (pausedRef.current) {
      dlog("flushServer skipped (paused)");
      return;
    }

    const draft = lastDraftRef.current;
    if (!draft?.draftId) {
      dlog("flushServer skipped (no draft)");
      return;
    }

    const key = JSON.stringify({ id: draft.draftId, updatedAt: draft.updatedAt });
    if (key === lastSentRef.current) {
      dlog("flushServer skipped (already sent)", { key });
      return;
    }

    try {
      lastSentRef.current = key;
      dlog("flushServer -> upsertServerDraft()", {
        draftId: draft.draftId,
        userId: draft.userId,
        workoutId: (draft as any).workoutId ?? null,
        planWorkoutId: (draft as any).planWorkoutId ?? null,
        updatedAt: draft.updatedAt,
      });
      await upsertServerDraft(draft);
      dlog("flushServer success");
    } catch (e: any) {
      dlog("flushServer failed", { message: String(e?.message ?? e) });
      // silent; local is source of truth while offline
    }
  }, [enabledServer]);

  const persist = useCallback(
    async (draft: LiveWorkoutDraft) => {
      lastDraftRef.current = draft;

      if (pausedRef.current) {
        dlog("persist called but PAUSED (skipping)", {
          draftId: draft?.draftId,
          userId: draft?.userId,
          workoutId: (draft as any)?.workoutId ?? null,
          planWorkoutId: (draft as any)?.planWorkoutId ?? null,
          updatedAt: draft?.updatedAt,
        });
        return;
      }

      // 1) Always local
      dlog("local save -> saveLiveDraftForUser()", {
        draftId: draft?.draftId,
        userId: draft?.userId,
        workoutId: (draft as any)?.workoutId ?? null,
        planWorkoutId: (draft as any)?.planWorkoutId ?? null,
        updatedAt: draft?.updatedAt,
      });

      await saveLiveDraftForUser(draft.userId, draft);

      // 2) Debounced server
      if (!enabledServer) return;

      const key = JSON.stringify({ id: draft.draftId, updatedAt: draft.updatedAt });
      if (key === lastSentRef.current) {
        dlog("server debounce skipped (same key)", { key });
        return;
      }

      cancelTimer();

      dlog("server debounce scheduled", { ms: serverDebounceMs, key });

      timerRef.current = setTimeout(async () => {
        if (pausedRef.current) {
          dlog("server timer fired but PAUSED (skipping)", { key });
          return;
        }

        try {
          lastSentRef.current = key;
          dlog("server upsert -> upsertServerDraft()", {
            draftId: draft.draftId,
            userId: draft.userId,
            workoutId: (draft as any)?.workoutId ?? null,
            planWorkoutId: (draft as any)?.planWorkoutId ?? null,
            updatedAt: draft.updatedAt,
          });

          await upsertServerDraft(draft);
          dlog("server upsert success");
        } catch (e: any) {
          dlog("server upsert failed", { message: String(e?.message ?? e) });
          // silent; local is source of truth while offline
        }
      }, serverDebounceMs);
    },
    [enabledServer, serverDebounceMs, cancelTimer]
  );

  useEffect(() => {
    return () => {
      cancelTimer();
      dlog("unmount cleanup");
    };
  }, [cancelTimer]);

  return { persist, pause, resume, flushServer, cancelTimer };
}
