import { supabase } from "@/lib/supabase";
import type { WorkoutLoadPayload, LiveWorkoutDraft } from "../state/types";
import { buildDraftFromBootstrap } from "../../hooks/buildDraft";
import { loadLiveDraftForUser, saveLiveDraftForUser } from "../persist/local";
import { fetchServerDraft } from "../persist/server";

/**
 * Boot order:
 * 1) Server draft (if newer)
 * 2) Local draft
 * 3) RPC bootstrap -> build new draft
 */
export async function bootLiveDraft(args: {
  userId: string;
  workoutId?: string;
  planWorkoutId?: string | null;
  preferServer?: boolean;
}): Promise<LiveWorkoutDraft> {
  const { userId, workoutId, planWorkoutId, preferServer = true } = args;

  // Attempt server first (if enabled)
  if (preferServer) {
    const server = await fetchServerDraft(userId);
    if (server?.draftId) {
      // also cache locally
      await saveLiveDraftForUser(userId, server);
      return server;
    }
  }

  // Local resume
  const local = await loadLiveDraftForUser(userId);
  if (local?.draftId) return local;

  // Need workoutId to create a new session
  if (!workoutId) {
    throw new Error("No workoutId provided to start a session.");
  }

  const { data, error } = await supabase.rpc("get_workout_session_bootstrap", {
    p_workout_id: workoutId,
    p_plan_workout_id: planWorkoutId ?? null,
  });
  if (error) throw error;

  const payload = data as WorkoutLoadPayload;
  const next = buildDraftFromBootstrap({ userId, payload });

  await saveLiveDraftForUser(userId, next);
  return next;
}
