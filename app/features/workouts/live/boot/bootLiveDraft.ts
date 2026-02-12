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

  const [local, server] = await Promise.all([
    loadLiveDraftForUser(userId),
    preferServer ? fetchServerDraft(userId) : Promise.resolve(null),
  ]);

  const hasLocal = !!local?.draftId;
  const hasServer = !!server?.draftId;

  const localUpdated =
    hasLocal && local?.updatedAt ? Date.parse(local.updatedAt) : 0;
  const serverUpdated =
    hasServer && server?.updatedAt ? Date.parse(server.updatedAt) : 0;

  console.log("bootLiveDraft", {
    preferServer,
    hasLocal,
    localUpdated: local?.updatedAt ?? null,
    hasServer,
    serverUpdated: server?.updatedAt ?? null,
    pick:
      hasServer && (!hasLocal || serverUpdated >= localUpdated)
        ? "server"
        : hasLocal
        ? "local"
        : "bootstrap",
  });

  // 1) Server if newer (or local missing)
  if (hasServer && (!hasLocal || serverUpdated >= localUpdated)) {
    await saveLiveDraftForUser(userId, server!); // cache server locally
    return server!;
  }

  // 2) Local
  if (hasLocal) return local!;

  // 3) Bootstrap
  if (!workoutId) throw new Error("No workoutId provided to start a session.");

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
