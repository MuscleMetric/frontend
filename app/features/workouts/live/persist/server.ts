//features/workouts/live/persist/server.ts
import { supabase } from "@/lib/supabase";
import type { LiveWorkoutDraft } from "../state/types";

/**
 * Server storage is optional but recommended.
 * Uses table: public.live_workout_drafts (see SQL below).
 */

export async function fetchServerDraft(userId: string): Promise<LiveWorkoutDraft | null> {
  const { data, error } = await supabase
    .from("live_workout_drafts")
    .select("draft, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return null;
  if (!data?.draft) return null;

  try {
    return data.draft as LiveWorkoutDraft;
  } catch {
    return null;
  }
}

export async function upsertServerDraft(draft: LiveWorkoutDraft): Promise<void> {
  // store full draft JSON
  await supabase.from("live_workout_drafts").upsert(
    {
      user_id: draft.userId,
      workout_id: draft.workoutId,
      plan_workout_id: draft.planWorkoutId,
      updated_at: draft.updatedAt,
      draft,
    },
    { onConflict: "user_id" }
  );
}

export async function clearServerDraft(userId: string): Promise<void> {
  await supabase.from("live_workout_drafts").delete().eq("user_id", userId);
}
