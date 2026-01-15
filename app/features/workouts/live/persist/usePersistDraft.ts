import { useCallback, useEffect, useRef } from "react";
import type { LiveWorkoutDraft } from "../state/types";
import { saveLiveDraftForUser } from "./local";
import { upsertServerDraft } from "./server";

/**
 * Immediate local persistence + debounced server persistence.
 */
export function usePersistDraft(args: {
  enabledServer?: boolean;          // default true
  serverDebounceMs?: number;        // default 1200ms
}) {
  const enabledServer = args.enabledServer ?? true;
  const serverDebounceMs = args.serverDebounceMs ?? 1200;

  const timerRef = useRef<any>(null);
  const lastSentRef = useRef<string>("");

  const persist = useCallback(async (draft: LiveWorkoutDraft) => {
    // 1) Always local
    await saveLiveDraftForUser(draft.userId, draft);

    // 2) Debounced server
    if (!enabledServer) return;

    const key = JSON.stringify({ id: draft.draftId, updatedAt: draft.updatedAt });
    if (key === lastSentRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        lastSentRef.current = key;
        await upsertServerDraft(draft);
      } catch {
        // silent; local is source of truth while offline
      }
    }, serverDebounceMs);
  }, [enabledServer, serverDebounceMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { persist };
}
